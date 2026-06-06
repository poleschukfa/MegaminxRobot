const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Server } = require('socket.io');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(idx + 1).trim();
    }
  }
}

loadEnvFile(path.join(__dirname, '.env'));

const users = require('./lib/users');
const dailyChallenge = require('./lib/dailyChallenge');
const { buildIceServers } = require('./lib/iceServers');

const CONTROL_PASSWORD = process.env.CONTROL_PASSWORD || '';
const BROADCASTER_SECRET = process.env.BROADCASTER_SECRET || '';
const API_SECRET = process.env.API_SECRET || CONTROL_PASSWORD || '';
const REGISTRATION_ENABLED = process.env.REGISTRATION_ENABLED === 'true' || process.env.REGISTRATION_ENABLED === '1';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 24 * 60 * 60 * 1000;
const viewerSessions = new Map();

function authEnabled() {
  return !!CONTROL_PASSWORD || REGISTRATION_ENABLED || users.hasUsers();
}

function createViewerSession(username = null) {
  const token = crypto.randomBytes(32).toString('hex');
  viewerSessions.set(token, {
    expiresAt: Date.now() + SESSION_TTL_MS,
    username: username || null,
  });
  return token;
}

function isValidViewerSession(token) {
  if (!authEnabled()) return true;
  if (!token) return false;
  const session = viewerSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    viewerSessions.delete(token);
    return false;
  }
  return true;
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of viewerSessions) {
    if (!session?.expiresAt || session.expiresAt <= now) viewerSessions.delete(token);
  }
}

setInterval(purgeExpiredSessions, 15 * 60 * 1000).unref();

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function getViewerUsernameFromToken(token) {
  if (!token) return null;
  const session = viewerSessions.get(token);
  return session?.username || null;
}

function isApiAuthorized(req) {
  if (!API_SECRET) return true;
  const token = extractBearerToken(req);
  return token === API_SECRET || isValidViewerSession(token);
}

function requireApiAuth(req, res, next) {
  if (isApiAuthorized(req)) return next();
  return res.status(401).json({ status: 'error', message: 'Требуется авторизация' });
}

function isBroadcasterSecretValid(secret) {
  if (!BROADCASTER_SECRET) return true;
  return secret === BROADCASTER_SECRET;
}

// Симулятор собирается и синхронизируется в public/MegaMinx
// (npm run build:simulator -> MegaMinx/build -> public/MegaMinx)
// На проде раздаём именно public/MegaMinx, чтобы не зависеть от наличия MegaMinx/build.
const MEGAMINX_BUILD = path.join(__dirname, 'public', 'MegaMinx');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://roborubiks.ru", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// Для парсинга JSON в POST запросах
app.use(express.json());

// Хранилище состояния
let broadcaster = null;
const viewerQueue = [];
let activeViewer = null;
const socketToRole = new Map();
let robotResetInProgress = false;
let robotResetTimer = null;

const ROBOT_RESET_TIMEOUT_MS = Number(process.env.ROBOT_RESET_TIMEOUT_MS) || 600_000;

function broadcastRobotResetState() {
  const payload = { resetting: robotResetInProgress };
  io.emit('robot_resetting', payload);
}

function beginRobotReset(reason = 'go_to_init') {
  if (robotResetInProgress) return;
  robotResetInProgress = true;
  console.log(`⏳ Сброс робота (${reason}) — очередь на паузе`);
  broadcastRobotResetState();
  clearTimeout(robotResetTimer);
  robotResetTimer = setTimeout(() => {
    if (!robotResetInProgress) return;
    console.warn('⏱️ Таймаут go_to_init — разблокируем очередь');
    finishRobotReset();
  }, ROBOT_RESET_TIMEOUT_MS);
}

function finishRobotReset() {
  if (!robotResetInProgress) return;
  robotResetInProgress = false;
  clearTimeout(robotResetTimer);
  robotResetTimer = null;
  console.log('✅ Сброс робота завершён — очередь возобновлена');
  broadcastRobotResetState();
  tryConnectNextViewer();
}

function requestGoToInit(reason = 'viewer_left') {
  beginRobotReset(reason);
  if (broadcaster) {
    io.to(broadcaster).emit('command', { command: 'go_to_init', params: {} });
  } else {
    console.warn('go_to_init запрошен, но стример офлайн');
    finishRobotReset();
  }
}

function updateQueuePositions() {
  viewerQueue.forEach((id, index) => {
    io.to(id).emit('queue position', index + 1);
  });
}

function tryConnectNextViewer() {
  if (!broadcaster || activeViewer || viewerQueue.length === 0 || robotResetInProgress) return;

  const nextViewerId = viewerQueue.shift();
  activeViewer = nextViewerId;

  io.to(activeViewer).emit('you are active');
  io.to(broadcaster).emit('viewer connected', activeViewer);

  console.log(`▶️ Активный зритель: ${activeViewer}. Осталось в очереди: ${viewerQueue.length}`);
  updateQueuePositions();
}

// Очередь HTTP-запросов, ждущих финальный ответ от робота (progress не закрывает запрос)
let lastResponse = null;
const pendingHttpCommands = [];

const HTTP_TIMEOUT_MS = {
  default: Number(process.env.API_COMMAND_TIMEOUT_MS) || 30_000,
  long: Number(process.env.API_LONG_COMMAND_TIMEOUT_MS) || 600_000,
};

function httpTimeoutForCommand(command) {
  if (command === 'execute_path' || command === 'go_to_init') return HTTP_TIMEOUT_MS.long;
  return HTTP_TIMEOUT_MS.default;
}

function waitForRobotResponse(command) {
  return new Promise((resolve) => {
    const entry = { resolve, command, createdAt: Date.now() };
    pendingHttpCommands.push(entry);
    entry.timer = setTimeout(() => {
      const idx = pendingHttpCommands.indexOf(entry);
      if (idx !== -1) {
        pendingHttpCommands.splice(idx, 1);
        resolve({ status: 'error', message: 'Таймаут ответа от робота' });
      }
    }, httpTimeoutForCommand(command));
  });
}

function resolveNextHttpCommand(response) {
  if (pendingHttpCommands.length === 0) return;
  const pending = pendingHttpCommands.shift();
  clearTimeout(pending.timer);
  pending.resolve(response);
}

async function sendRobotCommand(command, params = {}) {
  if (!broadcaster) {
    return { status: 'error', message: 'Стример офлайн' };
  }
  const responsePromise = waitForRobotResponse(command);
  io.to(broadcaster).emit('command', { command, params });
  return responsePromise;
}

// Запрос состояния симулятора (кнопка «Состояние» в viewer)
const pendingViewerStateRequests = [];
const VIEWER_STATE_TIMEOUT_MS = Number(process.env.API_VIEWER_STATE_TIMEOUT_MS) || 120_000;

function waitForViewerState() {
  return new Promise((resolve) => {
    const entry = { resolve, createdAt: Date.now() };
    pendingViewerStateRequests.push(entry);
    entry.timer = setTimeout(() => {
      const idx = pendingViewerStateRequests.indexOf(entry);
      if (idx !== -1) {
        pendingViewerStateRequests.splice(idx, 1);
        resolve({ status: 'error', message: 'Таймаут ответа от симулятора' });
      }
    }, VIEWER_STATE_TIMEOUT_MS);
  });
}

function resolveViewerState(response) {
  if (pendingViewerStateRequests.length === 0) return;
  const pending = pendingViewerStateRequests.shift();
  clearTimeout(pending.timer);
  pending.resolve(response);
}

async function requestSolveStateFromViewer() {
  if (!activeViewer) {
    return { status: 'error', message: 'Нет активного зрителя' };
  }
  const responsePromise = waitForViewerState();
  io.to(activeViewer).emit('request_solve_state', {});
  return responsePromise;
}

app.use(express.static('public'));
app.use('/notebooks', express.static(path.join(__dirname, 'notebooks')));
app.get('/notebooks/colab', (req, res) => {
  let host = req.get('x-forwarded-host') || req.get('host') || 'roborubiks.ru';
  host = String(host).split(',')[0].trim();
  let proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  if (host.startsWith('127.0.0.1') || host.startsWith('localhost')) {
    host = 'roborubiks.ru';
    proto = 'https';
  }
  const notebookUrl = `${proto}://${host}/notebooks/megaminx_api.ipynb`;
  const colabUrl = `https://colab.research.google.com/notebook?fileUrl=${encodeURIComponent(notebookUrl)}`;
  res.redirect(302, colabUrl);
});
app.get('/notebooks/megaminx_client.py', (req, res) => {
  const clientPath = path.join(__dirname, 'notebooks', 'megaminx_client.py');
  res.type('text/plain; charset=utf-8').sendFile(clientPath);
});
// Serve MegaMinx build from public/MegaMinx.
// CRA hashes main.*.js — some deploys can end up with stale index.html.
// To make it robust, we rewrite the script src in index.html to the actual main.*.js on disk.
function resolveMegaMinxMainJs() {
  try {
    const jsDir = path.join(MEGAMINX_BUILD, 'static', 'js');
    const files = fs.readdirSync(jsDir);
    const main = files.find((f) => /^main\.[a-f0-9]+\.js$/i.test(f));
    return main ? `/MegaMinx/static/js/${main}` : null;
  } catch (_) {
    return null;
  }
}

app.get('/api/megaminx_build', (req, res) => {
  const indexPath = path.join(MEGAMINX_BUILD, 'index.html');
  let indexMain = null;
  try {
    const html = fs.readFileSync(indexPath, 'utf8');
    const m = html.match(/\/MegaMinx\/static\/js\/(main\.[a-f0-9]+\.js)/i);
    indexMain = m ? m[1] : null;
  } catch (_) { /* ignore */ }

  const diskMain = resolveMegaMinxMainJs();
  res.json({
    status: 'ok',
    megaminxBuildPath: MEGAMINX_BUILD,
    indexMain,
    diskMain, // e.g. /MegaMinx/static/js/main.74718e70.js
    indexExists: fs.existsSync(indexPath),
  });
});

app.get(['/MegaMinx', '/MegaMinx/', '/MegaMinx/index.html'], (req, res) => {
  const indexPath = path.join(MEGAMINX_BUILD, 'index.html');
  const mainJs = resolveMegaMinxMainJs();
  if (!mainJs) return res.sendFile(indexPath);
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) return res.sendFile(indexPath);
    const rewritten = html.replace(/\/MegaMinx\/static\/js\/main\.[a-f0-9]+\.js/gi, mainJs);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(rewritten);
  });
});

app.use('/MegaMinx', express.static(MEGAMINX_BUILD, { index: 'index.html' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    broadcaster: !!broadcaster,
    queueLength: viewerQueue.length,
    activeViewer: !!activeViewer,
    robotResetting: robotResetInProgress,
    apiVersion: 2,
    features: {
      solve_state: true,
      http_command: true,
      auth: authEnabled(),
      registration: REGISTRATION_ENABLED,
      daily_challenge: true,
    },
  });
});

app.get('/api/auth/config', (req, res) => {
  res.json({
    status: 'ok',
    authRequired: authEnabled(),
    apiAuthRequired: !!API_SECRET,
    registrationEnabled: REGISTRATION_ENABLED,
  });
});

app.get('/api/webrtc/ice', (req, res) => {
  res.json({
    status: 'ok',
    iceServers: buildIceServers(),
  });
});

app.post('/api/auth/register', (req, res) => {
  if (!REGISTRATION_ENABLED) {
    return res.status(403).json({ status: 'error', message: 'Регистрация отключена' });
  }
  const { username, password } = req.body || {};
  const result = users.createUser(username, password);
  if (!result.ok) {
    return res.status(400).json({ status: 'error', message: result.message });
  }
  res.json({
    status: 'ok',
    message: 'Аккаунт создан',
    username: result.user.username,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!authEnabled()) {
    return res.json({ status: 'ok', token: null, authRequired: false });
  }

  const pass = String(password || '');
  const name = users.normalizeUsername(username);

  if (!name && CONTROL_PASSWORD && pass === CONTROL_PASSWORD) {
    const token = createViewerSession('admin');
    return res.json({ status: 'ok', token, authRequired: true, username: 'admin' });
  }

  if (!name || !pass) {
    return res.status(400).json({ status: 'error', message: 'Укажите логин и пароль' });
  }

  const user = users.findByUsername(name);
  if (!user || !users.verifyPassword(pass, user)) {
    return res.status(401).json({ status: 'error', message: 'Неверный логин или пароль' });
  }

  const token = createViewerSession(user.username);
  res.json({ status: 'ok', token, authRequired: true, username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req) || req.body?.token;
  if (token) viewerSessions.delete(token);
  res.json({ status: 'ok' });
});

app.get('/api/daily-challenge', (req, res) => {
  const token = extractBearerToken(req);
  const username = isValidViewerSession(token) ? getViewerUsernameFromToken(token) : null;
  const result = dailyChallenge.getTodayChallenge(username);
  if (!result.ok) {
    return res.status(503).json({ status: 'error', message: result.message });
  }
  res.json({ status: 'ok', ...result.challenge });
});

app.post('/api/daily-challenge/submit', requireApiAuth, async (req, res) => {
  const token = extractBearerToken(req);
  const username = getViewerUsernameFromToken(token);
  if (!username) {
    return res.status(401).json({ status: 'error', message: 'Требуется вход в аккаунт' });
  }

  const activeSocket = activeViewer ? io.sockets.sockets.get(activeViewer) : null;
  const activeUsername = activeSocket?.data?.username || null;
  if (!activeViewer || activeUsername !== username) {
    return res.status(403).json({
      status: 'error',
      message: 'Отправить решение может только активный зритель',
    });
  }

  const { path: solutionPath, solve_time_ms: solveTimeMs, attempt_id: attemptId } = req.body || {};

  const attemptCheck = dailyChallenge.validateAttempt(username, attemptId);
  if (!attemptCheck.ok) {
    return res.status(403).json({ status: 'error', message: attemptCheck.message });
  }

  const solveState = await requestSolveStateFromViewer();
  if (solveState.status !== 'ok') {
    return res.status(400).json({
      status: 'error',
      message: solveState.message || 'Не удалось проверить состояние симулятора',
    });
  }

  if (!solveState.solved) {
    dailyChallenge.lockAttempt(username, attemptId);
    return res.json({
      status: 'ok',
      correct: false,
      solved: false,
      locked: true,
      message: 'Мегаминкс не собран — начните челлендж заново (go_to_init → перемешивание)',
    });
  }

  const result = dailyChallenge.submitSolution({
    username,
    path: solutionPath,
    solveTimeMs,
    solved: true,
    attemptId,
  });
  if (!result.ok) {
    return res.status(400).json({ status: 'error', message: result.message });
  }
  res.json({
    status: 'ok',
    correct: result.correct,
    solved: true,
    date: result.date,
    move_count: result.move_count,
    solve_time_ms: result.solve_time_ms,
    already_submitted: result.already_submitted,
    improved: result.improved,
    message: result.correct ? 'Мегаминкс собран!' : 'Мегаминкс не собран',
  });
});

app.get('/api/daily-challenge/leaderboard', (req, res) => {
  const date = String(req.query.date || dailyChallenge.todayKey()).trim();
  const result = dailyChallenge.getLeaderboard(date);
  res.json({ status: 'ok', ...result });
});

app.get('/api/daily-challenge/dates', (req, res) => {
  res.json({ status: 'ok', dates: dailyChallenge.getLeaderboardDates() });
});

app.post('/api/daily-challenge/attempt', requireApiAuth, (req, res) => {
  const token = extractBearerToken(req);
  const username = getViewerUsernameFromToken(token);
  if (!username) {
    return res.status(401).json({ status: 'error', message: 'Требуется вход в аккаунт' });
  }
  const result = dailyChallenge.beginAttempt(username);
  if (!result.ok) {
    return res.status(400).json({ status: 'error', message: result.message });
  }
  res.json({ status: 'ok', attempt_id: result.attempt_id, date: result.date });
});

app.post('/api/daily-challenge/lock-attempt', requireApiAuth, (req, res) => {
  const token = extractBearerToken(req);
  const username = getViewerUsernameFromToken(token);
  if (!username) {
    return res.status(401).json({ status: 'error', message: 'Требуется вход в аккаунт' });
  }
  const { attempt_id: attemptId } = req.body || {};
  dailyChallenge.lockAttempt(username, attemptId);
  res.json({ status: 'ok', locked: true });
});

app.get('/api/features', (req, res) => {
  res.json({
    status: 'ok',
    apiVersion: 2,
    features: {
      solve_state: true,
      solve_state_route: 'GET /api/solve-state',
    },
  });
});

// API для отправки команд через HTTP
app.post('/api/command', requireApiAuth, async (req, res) => {
  const { command, params } = req.body;

  if (command === 'set_stickers' || command === 'set_face_colors' || command === 'set_piece_colors') {
    if (!activeViewer) {
      return res.status(400).json({ status: 'error', message: 'Нет активного зрителя' });
    }
    console.log(`🎨 ${command} → симулятор`, params);
    io.to(activeViewer).emit('apply_face_colors', params || {});
    return res.json({ status: 'ok', message: 'Цвета отправлены в симулятор' });
  }

  // Как кнопка «Состояние» в viewer: solver симулятора → solve_path + reverse_path
  if (command === 'get_solve_state') {
    if (!activeViewer) {
      return res.status(400).json({ status: 'error', message: 'Нет активного зрителя' });
    }
    console.log('📨 HTTP API: get_solve_state → viewer');
    const response = await requestSolveStateFromViewer();
    return res.json(response);
  }
  
  if (!broadcaster) {
    return res.status(503).json({ status: 'error', message: 'Стример офлайн' });
  }
  
  if (!activeViewer) {
    return res.status(400).json({ status: 'error', message: 'Нет активного зрителя' });
  }
  
  console.log(`📨 HTTP API команда: ${command}`, params);
  const response = await sendRobotCommand(command, params || {});
  res.json(response);
});

app.get('/api/state', requireApiAuth, async (req, res) => {
  if (!broadcaster) {
    return res.status(503).json({ status: 'error', message: 'Стример офлайн' });
  }
  if (!activeViewer) {
    return res.status(400).json({ status: 'error', message: 'Нет активного зрителя' });
  }
  const response = await sendRobotCommand('get_state', {});
  res.json(response);
});

app.get('/api/history', requireApiAuth, async (req, res) => {
  if (!broadcaster) {
    return res.status(503).json({ status: 'error', message: 'Стример офлайн' });
  }
  if (!activeViewer) {
    return res.status(400).json({ status: 'error', message: 'Нет активного зрителя' });
  }
  const response = await sendRobotCommand('get_history', {});
  res.json(response);
});

app.get('/api/solve-state', requireApiAuth, async (req, res) => {
  if (!activeViewer) {
    return res.status(400).json({ status: 'error', message: 'Нет активного зрителя' });
  }
  console.log('📨 HTTP GET /api/solve-state → viewer');
  const response = await requestSolveStateFromViewer();
  res.json(response);
});

app.post('/api/scan', requireApiAuth, async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ status: 'error', message: 'Нет изображения' });

    // Сохраняем временный файл
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, '');
    const filename = `scan_${Date.now()}.jpg`;
    const filepath = path.join(__dirname, 'tmp', filename);
    fs.writeFileSync(filepath, base64Data, 'base64');

    // Запускаем Python скрипт распознавания
    const python = spawn('python3', ['vision/recognize_colors.py', filepath]);

    let output = '';
    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { console.error(`stderr: ${data}`); });

    python.on('close', async (code) => {
        fs.unlinkSync(filepath); // удаляем временный файл
        if (code !== 0) {
            return res.status(500).json({ status: 'error', message: 'Ошибка распознавания' });
        }
        try {
            const state = JSON.parse(output); // { faces: { U: "white", F: "red", ... } }
            // Теперь вызываем солвер (например, через другой Python скрипт или используем встроенный)
            const solution = await getSolution(state);
            res.json({ status: 'ok', solution });
        } catch (err) {
            res.status(500).json({ status: 'error', message: err.message });
        }
    });
});

// Функция вызова солвера
async function getSolution(state) {
    return new Promise((resolve, reject) => {
        const solver = spawn('python3', ['solver/solve.py', JSON.stringify(state)]);
        let output = '';
        solver.stdout.on('data', (data) => { output += data.toString(); });
        solver.stderr.on('data', (data) => { console.error(`solver stderr: ${data}`); });
        solver.on('close', (code) => {
            if (code !== 0) reject(new Error('Солвер не смог найти решение'));
            else resolve(output.trim());
        });
    });
}

// API документация
app.get('/api', (req, res) => {
  res.sendFile(__dirname + '/public/api-docs.html');
});

io.use((socket, next) => {
  const auth = socket.handshake.auth || {};
  socket.data.viewerAuthed = isValidViewerSession(auth.token);
  socket.data.broadcasterAuthed = isBroadcasterSecretValid(auth.broadcasterSecret);
  socket.data.username = getViewerUsernameFromToken(auth.token);
  next();
});

io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  console.log(`[${new Date().toISOString()}] Новое соединение: ${socket.id} (IP: ${clientIp})`);

  socket.on('register as broadcaster', (payload = {}) => {
    const secret = payload.secret || socket.handshake.auth?.broadcasterSecret || '';
    if (!isBroadcasterSecretValid(secret)) {
      socket.emit('error', 'Неверный ключ стримера');
      return;
    }
    if (broadcaster) {
      socket.emit('error', 'Стример уже существует');
      return;
    }
    broadcaster = socket.id;
    socketToRole.set(socket.id, 'broadcaster');
    socket.data.broadcasterAuthed = true;
    console.log(`📹 Стример зарегистрирован: ${socket.id}`);
    socket.emit('registered as broadcaster');
  });

  socket.on('register as viewer', () => {
    if (authEnabled() && !socket.data.viewerAuthed) {
      socket.emit('error', 'Требуется авторизация');
      return;
    }
    if (!broadcaster) {
      socket.emit('error', 'Стример офлайн');
      return;
    }
    if (robotResetInProgress) {
      socket.emit('error', 'Робот возвращается в начальное состояние. Подождите.');
      socket.emit('robot_resetting', { resetting: true });
      return;
    }
    socketToRole.set(socket.id, 'viewer');
    viewerQueue.push(socket.id);
    console.log(`👀 Зритель в очереди: ${socket.id}. Длина очереди: ${viewerQueue.length}`);
    
    socket.emit('queue position', viewerQueue.indexOf(socket.id) + 1);
    socket.emit('robot_resetting', { resetting: robotResetInProgress });
    tryConnectNextViewer();
  });

  socket.on('offer', (payload) => {
    if (socket.id === broadcaster && activeViewer) {
      io.to(activeViewer).emit('offer', payload);
    }
  });

  socket.on('answer', (payload) => {
    if (socket.id === activeViewer && broadcaster) {
      io.to(broadcaster).emit('answer', payload);
    }
  });

  socket.on('ice-candidate', (candidate) => {
    const role = socketToRole.get(socket.id);
    if (role === 'broadcaster' && activeViewer) {
      io.to(activeViewer).emit('ice-candidate', candidate);
    } else if (role === 'viewer' && socket.id === activeViewer && broadcaster) {
      io.to(broadcaster).emit('ice-candidate', candidate);
    }
  });

  socket.on('command', (data) => {
    if (authEnabled() && !socket.data.viewerAuthed) {
      socket.emit('error', 'Требуется авторизация');
      return;
    }
    if (socket.id === activeViewer && broadcaster) {
      console.log(`📨 Команда от зрителя: ${data.command}`, data.params || '');
      if (data.command === 'go_to_init') {
        beginRobotReset('viewer_command');
      }
      io.to(broadcaster).emit('command', data);
    }
  });

  socket.on('solve_state_response', (response) => {
    if (socket.id !== activeViewer) return;
    console.log('📥 solve_state_response от viewer');
    resolveViewerState(response || { status: 'error', message: 'Пустой ответ' });
  });

  socket.on('command_response', (response) => {
    if (socket.id !== broadcaster) return;

    console.log(`📤 Ответ стримера:`, response.progress ? '(progress)' : response.status);

    // Промежуточные ходы execute_path — только в viewer (симулятор), HTTP ждёт финал
    if (activeViewer) {
      io.to(activeViewer).emit('command_response', response);
    }

    if (response.progress) return;

    if (robotResetInProgress) {
      finishRobotReset();
    }

    lastResponse = response;
    resolveNextHttpCommand(response);
  });

  socket.on('disconnect', () => {
    const role = socketToRole.get(socket.id);
    console.log(`❌ Отключился: ${socket.id} (${role || 'неизвестная роль'})`);

    if (role === 'broadcaster') {
      broadcaster = null;
      activeViewer = null;
      viewerQueue.length = 0;
      socketToRole.clear();
      robotResetInProgress = false;
      clearTimeout(robotResetTimer);
      robotResetTimer = null;
      io.emit('broadcaster offline');
    } else if (role === 'viewer') {
      const queueIndex = viewerQueue.indexOf(socket.id);
      if (queueIndex !== -1) viewerQueue.splice(queueIndex, 1);
      if (socket.id === activeViewer) {
        activeViewer = null;
        if (!robotResetInProgress) {
          requestGoToInit('viewer_left');
        }
      }
    }
    socketToRole.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 Домен: https://roborubiks.ru`);
  console.log(`📚 API документация: https://roborubiks.ru/api`);
  if (authEnabled()) console.log('🔐 Авторизация управления: включена');
  if (REGISTRATION_ENABLED) console.log('📝 Регистрация пользователей: включена');
  if (BROADCASTER_SECRET) console.log('🔐 Ключ стримера: задан');
  if (API_SECRET) console.log('🔐 API Bearer: задан');
});


