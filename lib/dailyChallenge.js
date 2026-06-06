const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHALLENGES_FILE = path.join(__dirname, '..', 'data', 'daily_challenges.json');
const SUBMISSIONS_FILE = path.join(__dirname, '..', 'data', 'daily_submissions.json');
const TZ = process.env.DAILY_CHALLENGE_TZ || 'Europe/Moscow';
const MOVE_COUNT = Number(process.env.DAILY_CHALLENGE_MOVES) || 500;
const FACES = ['U', 'D', 'F', 'B', 'L', 'R', 'BL', 'BR', 'FL', 'FR', 'DL', 'DR'];

function ensureFile(filePath, fallback) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

function readJson(filePath, fallback) {
  ensureFile(filePath, fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureFile(filePath, data);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function todayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function inverseMove(move) {
  const m = String(move || '').trim();
  if (!m) return '';
  return m.endsWith("'") ? m.slice(0, -1) : `${m}'`;
}

function inversePath(pathStr) {
  const moves = normalizeMoves(pathStr);
  if (!moves.length) return '';
  return moves.reverse().map(inverseMove).join('.');
}

function normalizeMoves(pathStr) {
  return String(pathStr || '')
    .split(/[.\s]+/)
    .map((m) => m.trim())
    .filter(Boolean);
}

function normalizePath(pathStr) {
  return normalizeMoves(pathStr).join('.');
}

function seededRng(dateKey) {
  const hash = crypto.createHash('sha256').update(`daily-challenge:${dateKey}`).digest();
  let state = hash.readUInt32BE(0) ^ hash.readUInt32BE(4) ^ hash.readUInt32BE(8);
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const scrambleCache = new Map();

function generateScrambleForDate(dateKey) {
  if (scrambleCache.has(dateKey)) return scrambleCache.get(dateKey);
  const rng = seededRng(dateKey);
  const moves = [];
  for (let i = 0; i < MOVE_COUNT; i++) {
    const face = FACES[Math.floor(rng() * FACES.length)];
    moves.push(rng() < 0.5 ? `${face}'` : face);
  }
  const path = moves.join('.');
  scrambleCache.set(dateKey, path);
  return path;
}

function readChallengesStore() {
  return readJson(CHALLENGES_FILE, { challenges: [] });
}

function readSubmissionsStore() {
  const data = readJson(SUBMISSIONS_FILE, { submissions: [], attempts: [] });
  if (!Array.isArray(data.submissions)) data.submissions = [];
  if (!Array.isArray(data.attempts)) data.attempts = [];
  return data;
}

function writeSubmissionsStore(store) {
  writeJson(SUBMISSIONS_FILE, store);
}

function normalizeUser(username) {
  return String(username || '').trim().toLowerCase();
}

function getActiveAttempt(username, dateKey = todayKey()) {
  const name = normalizeUser(username);
  if (!name) return null;
  const store = readSubmissionsStore();
  const attempts = store.attempts
    .filter((a) => a.username === name && a.date === dateKey && a.submitAllowed)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return attempts[0] || null;
}

function beginAttempt(username) {
  const name = normalizeUser(username);
  if (!name) return { ok: false, message: 'Требуется авторизация' };

  const date = todayKey();
  const store = readSubmissionsStore();
  for (const attempt of store.attempts) {
    if (attempt.username === name && attempt.date === date && attempt.submitAllowed) {
      attempt.submitAllowed = false;
      attempt.lockedAt = attempt.lockedAt || new Date().toISOString();
    }
  }

  const attemptId = crypto.randomBytes(12).toString('hex');
  store.attempts.push({
    attemptId,
    date,
    username: name,
    createdAt: new Date().toISOString(),
    submitAllowed: true,
  });
  writeSubmissionsStore(store);

  return { ok: true, attempt_id: attemptId, date };
}

function validateAttempt(username, attemptId) {
  const name = normalizeUser(username);
  const id = String(attemptId || '').trim();
  if (!name || !id) {
    return { ok: false, message: 'Недействительная попытка — начните челлендж заново' };
  }
  const active = getActiveAttempt(name);
  if (!active || active.attemptId !== id) {
    return { ok: false, message: 'Отправка заблокирована — сначала go_to_init и повторите челлендж' };
  }
  return { ok: true, attempt: active };
}

function lockAttempt(username, attemptId) {
  const name = normalizeUser(username);
  const id = String(attemptId || '').trim();
  const store = readSubmissionsStore();
  const attempt = store.attempts.find(
    (a) => a.username === name && a.attemptId === id
  );
  if (attempt) {
    attempt.submitAllowed = false;
    attempt.lockedAt = new Date().toISOString();
    writeSubmissionsStore(store);
  }
  return { ok: true };
}

function consumeAttempt(username, attemptId) {
  return lockAttempt(username, attemptId);
}

function getChallengeForDate(dateKey) {
  const store = readChallengesStore();
  const fixed = store.challenges?.find((c) => c.date === dateKey);
  if (fixed?.scramble_path) {
    return {
      date: dateKey,
      title: fixed.title || `Daily ${dateKey}`,
      scramble_path: normalizePath(fixed.scramble_path),
      move_count: normalizeMoves(fixed.scramble_path).length,
    };
  }

  const scramble_path = generateScrambleForDate(dateKey);
  return {
    date: dateKey,
    title: `Daily ${dateKey}`,
    scramble_path,
    move_count: MOVE_COUNT,
  };
}

function findSubmission(username, dateKey) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readSubmissionsStore();
  return (
    store.submissions.find((s) => s.username === normalized && s.date === dateKey) || null
  );
}

function getTodayChallenge(username = null) {
  const date = todayKey();
  const challenge = getChallengeForDate(date);
  if (!challenge) {
    return { ok: false, message: 'Челлендж на сегодня недоступен' };
  }

  const submission = username ? findSubmission(username, date) : null;
  const activeAttempt = username ? getActiveAttempt(username, date) : null;
  const solved = !!submission?.correct;
  const name = normalizeUser(username);
  const store = name ? readSubmissionsStore() : null;
  const submitLocked = !!(
    name &&
    !solved &&
    !activeAttempt &&
    store?.attempts?.some((a) => a.username === name && a.date === date && !a.submitAllowed)
  );
  return {
    ok: true,
    challenge: {
      date: challenge.date,
      title: challenge.title,
      scramble_path: challenge.scramble_path,
      move_count: challenge.move_count,
      submitted: solved,
      correct: submission ? !!submission.correct : null,
      submitted_at: submission?.submittedAt || null,
      solve_time_ms: submission?.solveTimeMs ?? null,
      can_submit: !!activeAttempt,
      attempt_id: activeAttempt?.attemptId || null,
      submit_locked: submitLocked,
    },
  };
}

function submitSolution({ username, path: userPath, solveTimeMs, solved, attemptId }) {
  const name = String(username || '').trim().toLowerCase();
  if (!name) {
    return { ok: false, message: 'Требуется авторизация' };
  }

  const date = todayKey();
  const challenge = getChallengeForDate(date);
  if (!challenge) {
    return { ok: false, message: 'Челлендж на сегодня недоступен' };
  }

  const attemptCheck = validateAttempt(name, attemptId);
  if (!attemptCheck.ok) return attemptCheck;

  const normalizedUser = normalizePath(userPath);
  if (!normalizedUser) {
    return { ok: false, message: 'Укажите путь решения' };
  }

  const correct = !!solved;
  if (!correct) {
    consumeAttempt(name, attemptId);
    return {
      ok: true,
      correct: false,
      date,
      move_count: normalizeMoves(normalizedUser).length,
      already_submitted: false,
      improved: false,
      solve_time_ms: null,
      locked: true,
    };
  }
  const timeMs = Number(solveTimeMs);
  const hasValidTime = correct && Number.isFinite(timeMs) && timeMs > 0;

  const store = readSubmissionsStore();
  const existingIdx = store.submissions.findIndex(
    (s) => s.username === name && s.date === date
  );
  const existing = existingIdx >= 0 ? store.submissions[existingIdx] : null;

  if (existing?.correct && hasValidTime && timeMs >= existing.solveTimeMs) {
    consumeAttempt(name, attemptId);
    return {
      ok: true,
      correct: true,
      date,
      move_count: normalizeMoves(normalizedUser).length,
      already_submitted: true,
      improved: false,
      solve_time_ms: existing.solveTimeMs,
      locked: true,
    };
  }

  const entry = {
    date,
    username: name,
    path: normalizedUser,
    correct,
    solveTimeMs: hasValidTime ? Math.round(timeMs) : null,
    move_count: normalizeMoves(normalizedUser).length,
    submittedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    store.submissions[existingIdx] = entry;
  } else {
    store.submissions.push(entry);
  }
  writeSubmissionsStore(store);
  consumeAttempt(name, attemptId);

  const improved = !!(existing?.correct && hasValidTime && timeMs < existing.solveTimeMs);
  return {
    ok: true,
    correct,
    date,
    move_count: entry.move_count,
    already_submitted: !!existing?.correct,
    improved,
    solve_time_ms: entry.solveTimeMs,
    locked: true,
  };
}

function getLeaderboard(dateKey = todayKey()) {
  const store = readSubmissionsStore();
  const entries = store.submissions
    .filter((s) => s.date === dateKey && s.correct && s.solveTimeMs != null)
    .sort((a, b) => a.solveTimeMs - b.solveTimeMs || a.submittedAt.localeCompare(b.submittedAt))
    .map((s, index) => ({
      rank: index + 1,
      username: s.username,
      solve_time_ms: s.solveTimeMs,
      move_count: s.move_count || normalizeMoves(s.path).length,
      submitted_at: s.submittedAt,
    }));

  return {
    ok: true,
    date: dateKey,
    entries,
  };
}

function getLeaderboardDates() {
  const store = readSubmissionsStore();
  const dates = new Set(
    store.submissions.filter((s) => s.correct && s.solveTimeMs != null).map((s) => s.date)
  );
  dates.add(todayKey());
  return [...dates].sort().reverse();
}

module.exports = {
  todayKey,
  inversePath,
  normalizePath,
  generateScrambleForDate,
  getTodayChallenge,
  beginAttempt,
  lockAttempt,
  validateAttempt,
  submitSolution,
  getLeaderboard,
  getLeaderboardDates,
  MOVE_COUNT,
};
