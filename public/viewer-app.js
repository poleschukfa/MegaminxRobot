        // ============================================
        // КОНФИГУРАЦИЯ ГРАНЕЙ МЕГАМИНКСА
        // ИЗМЕНИТЕ ЗДЕСЬ ЦВЕТА И MOTOR_ID ПОД ВАШУ РЕАЛИЗАЦИЮ
        // ============================================
        // const faceConfig = [
        //     { code: 'U',  name: 'Верх',        color: '#FFFFFF', motor_id: 1  },  // Белый
        //     { code: 'D',  name: 'Низ',         color: '#555555', motor_id: 12  },  // Серый
        //     { code: 'F',  name: 'Перед',       color: '#FF0000', motor_id: 2  },  // Красный
        //     { code: 'B',  name: 'Зад',         color: '#FFA500', motor_id: 11  },  // Оранжевый
        //     { code: 'L',  name: 'Лево',        color: '#008000', motor_id: 6  },  // Зеленый
        //     { code: 'R',  name: 'Право',       color: '#000080', motor_id: 3  },  // Синий
        //     { code: 'BL', name: 'Зад-Лево',    color: '#880088', motor_id: 5  },  // Фиолетовый 
        //     { code: 'BR', name: 'Зад-Право',   color: '#ffff00', motor_id: 4  },  // Желтый
        //     { code: 'FL', name: 'Перед-Лево',  color: '#e5e5cC', motor_id: 9  },  // Коричневый
        //     { code: 'FR', name: 'Перед-Право', color: '#FFC0CB', motor_id: 8 },  // Розовый
        //     { code: 'DL', name: 'Низ-Лево',    color: '#00BFFF', motor_id: 10 },  // Голубой
        //     { code: 'DR', name: 'Низ-Право',   color: '#99FF99', motor_id: 7 }   // Салатовый
        // ];

        // const side = {
        //     'F': "white", 
        //     'FR': "blue", 
        //     'FL': "yellow", 
        //     'L': "purple", 
        //     'D': "salad",
        //     'R': "red", 
        //     'B': "grey", 
        //     'DR': "pink", 
        //     'BR': "desert", 
        //     'U': "green", 
        //     'BL': "light_blue",
        //     'DL': "orange" 
        // };


        if (!window.viewerConfig) {
            console.error('viewer-config.js not loaded');
            window.viewerConfig = { colorMap: {}, faceConfig: [], isBrightColor: () => false, rebuild: () => [] };
        }
        const { colorMap, isBrightColor } = window.viewerConfig;
        const t = (key, vars) => (window.viewerI18n ? window.viewerI18n.t(key, vars) : key);
        const getFaces = () => window.viewerConfig.faceConfig || [];

        function simulatorUrl() {
            const lang = window.viewerI18n?.getLang() || 'ru';
            return `/MegaMinx/index.html?embed=1&lang=${lang}&v=${Date.now()}`;
        }

        function isSolvedMarker(text) {
            return window.viewerI18n ? window.viewerI18n.isAlreadySolved(text) : String(text).trim() === 'уже собрано';
        }

        function localeTag() {
            return (window.viewerI18n?.getLang() || 'ru') === 'en' ? 'en-US' : 'ru-RU';
        }

        // Usage

        // Создаём CSS стили динамически на основе конфигурации
        function generateFaceStyles() {
            let styles = '';
            getFaces().forEach(face => {
                // Определяем цвет текста (белый или чёрный) в зависимости от яркости фона
                // const textColor = face.color === '#FFFFFF' || face.color === '#FFFF00' || face.color === '#C0C0C0' || face.color === '#00FF7F' 
                    // ? '#333' : 'white';

                const textColor = isBrightColor(face.color) ? '#333' : 'white';

                const textShadow = textColor === '#333' ? 'none' : '1px 1px 2px rgba(0,0,0,0.3)';
                
                styles += `
                    .face-${face.code} { background: ${face.color}; }
                    .face-${face.code} .face-header { 
                        background: ${face.color}; 
                        filter: brightness(0.85);
                        color: ${textColor};
                        text-shadow: ${textShadow};
                    }
                    .face-${face.code} .face-btn { 
                        background: ${face.color}; 
                        filter: brightness(1.1);
                        color: ${textColor};
                        text-shadow: ${textShadow};
                    }
                    .face-${face.code} .face-btn:hover { filter: brightness(1.2); }
                `;
            });
            
            const styleSheet = document.createElement('style');
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }

        // Отображение конфигурации во вкладке
        function displayConfig() {
            const configDisplay = document.getElementById('configDisplay');
            if (configDisplay) {
                configDisplay.textContent = JSON.stringify(getFaces(), null, 2);
            }
        }

        // Получить конфигурацию грани по коду
        function getFaceConfig(code) {
            return getFaces().find(f => f.code === code);
        }

        // Генерация легенды (отключено — подсказки на кнопках граней)
        function generateLegend() {}

        function setChipOnline() {
            if (!statusChip || !statusChipText) return;
            statusChip.classList.remove('error', 'warn', 'status-chip--labeled');
            statusChip.classList.add('ok');
            statusChipText.textContent = '';
            statusChip.setAttribute('aria-label', t('connected'));
        }

        /** Статус в шапке — только очередь и ошибки; в работе только индикатор */
        function setChip(text, isError = false) {
            if (!statusChip || !statusChipText) return;
            statusChip.classList.remove('ok', 'error', 'warn');
            if (isError) {
                statusChip.classList.add('error', 'status-chip--labeled');
            } else if (/⏳|очеред|позици|первые|подключ|queue|position|first|connect/i.test(text)) {
                statusChip.classList.add('warn', 'status-chip--labeled');
            } else {
                statusChip.classList.add('ok', 'status-chip--labeled');
            }
            const label = String(text).replace(/^[^\p{L}\p{N}]+/u, '').trim() || text;
            statusChipText.textContent = label;
            statusChip.setAttribute('aria-label', label);
        }

        function bindClick(id, handler) {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', handler);
        }

        function getPathText() {
            return (pathInput?.value || currentPath || solveOut?.textContent || '').trim();
        }

        async function copyPathToClipboard() {
            const text = getPathText();
            if (!text) {
                logEvent(t('noPathToCopy'), true);
                return;
            }
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    throw new Error('clipboard unavailable');
                }
                logEvent(t('pathCopied', { path: text }));
            } catch {
                if (pathInput) {
                    pathInput.value = text;
                    pathInput.select();
                    document.execCommand('copy');
                }
                logEvent(t('pathCopiedManual'));
            }
        }

        /** Состояние симулятора (solver): как для кнопки «Состояние» и HTTP get_solve_state */
        async function computeSolveState(updateUi = false) {
            showSimulator();
            const target = simulatorFrame.contentWindow;
            if (!target) {
                return { status: 'error', message: t('simNotLoaded') };
            }
            if (typeof target.roborubiksGetSolvePath !== 'function') {
                return { status: 'error', message: t('noSolverApiLong') };
            }
            const solvePath = target.roborubiksGetSolvePath();
            if (!solvePath) {
                return { status: 'error', message: t('solveNotFoundLong') };
            }
            if (isSolvedMarker(solvePath)) {
                if (updateUi) {
                    if (solveOut) solveOut.textContent = t('alreadySolved');
                    if (pathInput) pathInput.value = '';
                    logEvent(t('alreadySolved'));
                }
                return {
                    status: 'ok',
                    solved: true,
                    message: t('alreadySolved'),
                    solve_path: '',
                    reverse_path: '',
                };
            }
            const reversePath = inversePath(solvePath);
            if (!reversePath) {
                return { status: 'error', message: t('reversePathFailed') };
            }
            if (updateUi) {
                if (solveOut) solveOut.textContent = solvePath;
                if (pathInput) pathInput.value = reversePath;
                currentPath = reversePath;
                logEvent(reversePath);
            }
            return {
                status: 'ok',
                solved: false,
                solve_path: solvePath,
                reverse_path: reversePath,
            };
        }

        async function requestReversePathFromSimulator() {
            const result = await computeSolveState(true);
            if (result.status !== 'ok') {
                logEvent(result.message || t('error'), true);
                setStatus(result.message || t('error'), true);
                return null;
            }
            return result.solved ? null : result.reverse_path;
        }

        // ============================================

        window.copyCode = function(elementId) {
            const element = document.getElementById(elementId);
            const text = element.innerText;
            navigator.clipboard?.writeText(text).then(() => {
                const btn = event.target;
                btn.textContent = t('copiedBtn');
                setTimeout(() => btn.textContent = t('copyPath'), 2000);
            });
        };

        const AUTH_STORAGE_KEY = 'roborubiks_viewer_token';

        function getAuthToken() {
            try { return sessionStorage.getItem(AUTH_STORAGE_KEY) || ''; } catch (_) { return ''; }
        }

        function setAuthToken(token) {
            try {
                if (token) sessionStorage.setItem(AUTH_STORAGE_KEY, token);
                else sessionStorage.removeItem(AUTH_STORAGE_KEY);
            } catch (_) { /* ignore */ }
        }

        const socket = io({ auth: { token: getAuthToken() } });
        const remoteVideo = document.getElementById('remoteVideo');
        const joinBtn = document.getElementById('joinBtn');
        const leaveBtn = document.getElementById('leaveBtn');
        const authShell = document.getElementById('authShell');
        const authPanel = document.getElementById('authPanel');
        const authTabs = document.getElementById('authTabs');
        const authForm = document.getElementById('authForm');
        const registerForm = document.getElementById('registerForm');
        const authUsername = document.getElementById('authUsername');
        const authPassword = document.getElementById('authPassword');
        const registerUsername = document.getElementById('registerUsername');
        const registerPassword = document.getElementById('registerPassword');
        const authError = document.getElementById('authError');
        const authSuccess = document.getElementById('authSuccess');
        const authTabLogin = document.getElementById('authTabLogin');
        const authTabRegister = document.getElementById('authTabRegister');
        const authTitle = document.getElementById('authTitle');
        const authLead = document.getElementById('authLead');
        const landingControls = document.getElementById('landingControls');
        const logoutBtn = document.getElementById('logoutBtn');
        const apiTokenPanel = document.getElementById('apiTokenPanel');
        const apiTokenNoAuth = document.getElementById('apiTokenNoAuth');
        const apiTokenField = document.getElementById('apiTokenField');
        const apiTokenExample = document.getElementById('apiTokenExample');
        const apiTokenRevealBtn = document.getElementById('apiTokenRevealBtn');
        const apiTokenCopyBtn = document.getElementById('apiTokenCopyBtn');
        let authRequired = false;
        let registrationEnabled = false;
        let viewerAuthed = false;
        let authMode = 'login';
        let robotResetting = false;
        let lastQueuePosition = 0;

        function updateLogoutButton() {
            if (!logoutBtn) return;
            const show = authRequired && viewerAuthed && getAuthToken();
            logoutBtn.hidden = !show;
            updateApiTokenPanel();
        }

        function updateApiTokenPanel() {
            const token = getAuthToken();
            const showToken = authRequired && viewerAuthed && !!token;
            if (apiTokenPanel) apiTokenPanel.hidden = !showToken;
            if (apiTokenNoAuth) apiTokenNoAuth.hidden = authRequired || showToken;
            if (!showToken) return;
            if (apiTokenField) {
                apiTokenField.value = token;
                apiTokenField.type = 'password';
            }
            if (apiTokenRevealBtn) {
                apiTokenRevealBtn.textContent = t('apiTokenReveal');
            }
            if (apiTokenExample) {
                apiTokenExample.textContent =
                    `Authorization: Bearer ${token}\n\n` +
                    `# Python\nfrom megaminx_client import MegaminxClient\n` +
                    `api = MegaminxClient("${location.origin}", api_token="${token}")`;
            }
        }

        async function copyApiToken() {
            const token = getAuthToken();
            if (!token) return;
            try {
                await navigator.clipboard.writeText(token);
                logEvent(t('apiTokenCopied'));
            } catch {
                if (apiTokenField) {
                    apiTokenField.type = 'text';
                    apiTokenField.select();
                    document.execCommand('copy');
                    apiTokenField.type = 'password';
                }
                logEvent(t('apiTokenCopied'));
            }
        }

        function toggleApiTokenVisibility() {
            if (!apiTokenField || !apiTokenRevealBtn) return;
            const hidden = apiTokenField.type === 'password';
            apiTokenField.type = hidden ? 'text' : 'password';
            apiTokenRevealBtn.textContent = hidden ? t('apiTokenHide') : t('apiTokenReveal');
        }
        const queueInfo = document.getElementById('queueInfo');
        const queuePositionEl = document.getElementById('queuePosition');
        const queueMessageEl = document.getElementById('queueMessage');
        const controlPanel = document.getElementById('controlPanel');
        const responseLog = document.getElementById('responseLog');
        const pathInput = document.getElementById('pathInput');
        const executePathTiming = document.getElementById('executePathTiming');
        const historyList = document.getElementById('historyList');
        const simulatorSection = document.getElementById('simulatorSection');
        const simulatorFrame = document.getElementById('simulatorFrame');
        const solveBtn = document.getElementById('solveBtn');
        const solveOut = document.getElementById('solveOut');
        const dailyChallengeStartBtn = document.getElementById('dailyChallengeStartBtn');
        const dailyChallengeSubmitBtn = document.getElementById('dailyChallengeSubmitBtn');
        const dailyChallengeDate = document.getElementById('dailyChallengeDate');
        const dailyChallengeScramble = document.getElementById('dailyChallengeScramble');
        const dailyChallengeSolution = document.getElementById('dailyChallengeSolution');
        const dailySolutionInput = document.getElementById('dailySolutionInput');
        const dailyChallengeResult = document.getElementById('dailyChallengeResult');
        const controlGrid = document.getElementById('controlGrid');
        const statusChip = document.getElementById('statusChip');
        const statusChipText = document.getElementById('statusChipText');
        const welcomeCard = document.getElementById('welcomeCard');
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const mainLayout = document.getElementById('mainLayout');

        function updateLayoutMode() {
            const connected = isActive && controlPanel && controlPanel.style.display !== 'none';
            document.body.classList.toggle('viewer-idle', !isInQueue && !isActive);
            document.body.classList.toggle('viewer-queued', isInQueue && !isActive);
            document.body.classList.toggle('viewer-connecting', isActive && !connected);
            document.body.classList.toggle('viewer-active', connected);
            document.body.classList.toggle('viewer-controls', controlPanel && controlPanel.style.display !== 'none');
            if (mainLayout) {
                mainLayout.classList.toggle('has-controls', controlPanel && controlPanel.style.display !== 'none');
            }
        }

        function setWelcomeVisible(visible) {
            if (welcomeCard) welcomeCard.style.display = visible ? '' : 'none';
            updateLayoutMode();
        }

        function setVideoPlaceholderVisible(visible) {
            if (videoPlaceholder) videoPlaceholder.style.display = visible ? 'flex' : 'none';
        }

        let peerConnection = null;
        let isInQueue = false;
        let isActive = false;
        let currentPath = '';
        let simulatorReady = false;
        const pendingSimulatorCommands = [];

        function isSimulatorBlank() {
            const src = simulatorFrame.src;
            return !src || src === 'about:blank' || src.endsWith('about:blank');
        }

        function flushSimulatorQueue() {
            if (!simulatorReady || isSimulatorBlank()) return;
            while (pendingSimulatorCommands.length) {
                const msg = pendingSimulatorCommands.shift();
                deliverToSimulator(msg);
            }
        }

        let removeSimulatorHistoryGuard = null;

        function installSimulatorHistoryGuard() {
            if (removeSimulatorHistoryGuard) return;
            const pushAnchor = () => {
                try {
                    history.pushState({ roborubiksSimulator: true }, '', location.href);
                } catch (_) { /* ignore */ }
            };
            pushAnchor();
            const onPopState = () => pushAnchor();
            window.addEventListener('popstate', onPopState);
            removeSimulatorHistoryGuard = () => {
                window.removeEventListener('popstate', onPopState);
                removeSimulatorHistoryGuard = null;
            };
        }

        function syncSimulatorLang() {
            if (isSimulatorBlank()) return;
            const lang = window.viewerI18n?.getLang() || 'ru';
            const target = simulatorFrame.contentWindow;
            if (!target) return;
            if (typeof target.roborubiksSetLang === 'function') {
                target.roborubiksSetLang(lang);
            } else {
                target.postMessage({ type: 'megaminx_set_lang', lang }, window.location.origin);
            }
        }

        function showSimulator() {
            simulatorSection.classList.add('visible');
            updateLayoutMode();
            installSimulatorHistoryGuard();
            if (isSimulatorBlank()) {
                simulatorReady = false;
                pendingSimulatorCommands.length = 0;
                // index.html обходит service-worker (маршрут /MegaMinx/ отдавал старый кэш)
                simulatorFrame.src = simulatorUrl();
            }
        }

        function hideSimulator() {
            simulatorSection.classList.remove('visible');
            simulatorReady = false;
            pendingSimulatorCommands.length = 0;
            simulatorFrame.src = 'about:blank';
            updateLayoutMode();
        }

        function deliverToSimulator(msg) {
            const target = simulatorFrame.contentWindow;
            if (!target) return false;
            if (typeof target.roborubiksReceiveCommand === 'function') {
                target.roborubiksReceiveCommand(msg);
                return true;
            }
            target.postMessage(msg, window.location.origin);
            return true;
        }

        function resolveScanColor(value) {
            if (value == null) return null;
            const s = String(value).trim();
            if (s.startsWith('#')) return s;
            const key = s.toLowerCase().replace(/\s+/g, '_');
            return colorMap[key] || colorMap[s.toLowerCase()] || null;
        }

        function applyScanColorsToViewer(faces) {
            if (!faces) return;
            getFaces().forEach(face => {
                const hex = resolveScanColor(faces[face.code]);
                if (hex) face.color = hex;
            });
            generateFaceStyles();
            createFacesGrid();
        }

        function scanDataToStickers(scanData) {
            const stickers = [];
            const raw = scanData?.stickers ?? scanData?.state?.stickers;
            if (Array.isArray(raw)) stickers.push(...raw);
            const faces = scanData?.faces ?? scanData?.state?.faces;
            if (faces && typeof faces === 'object') {
                for (const [face, color] of Object.entries(faces)) {
                    stickers.push({ face, piece: 0, color });
                }
            }
            return stickers;
        }

        function paintSimulatorFromScan(scanData) {
            if (!scanData) return;
            // Мы можем перекрашивать симулятор даже до получения статуса "active".
            // Если iframe ещё не загружен, поднимем его и положим команду в очередь.
            showSimulator();
            if (scanData.faces) applyScanColorsToViewer(scanData.faces);
            const stickers = scanDataToStickers(scanData);
            if (!stickers.length) return;
            sendToSimulator('set_stickers', { stickers });
        }

        function sendToSimulator(command, params = {}) {
            if (isSimulatorBlank()) return;
            const msg = { type: 'megaminx_command', command, params };
            const target = simulatorFrame.contentWindow;
            if (target && typeof target.roborubiksReceiveCommand === 'function') {
                target.roborubiksReceiveCommand(msg);
                simulatorReady = true;
                return;
            }
            if (target && (command === 'set_stickers' || command === 'set_face_colors' || command === 'set_piece_colors') && typeof target.roborubiksApplyFaceColors === 'function') {
                target.roborubiksApplyFaceColors(params);
                simulatorReady = true;
                return;
            }
            if (!simulatorReady) {
                pendingSimulatorCommands.push(msg);
                return;
            }
            deliverToSimulator(msg);
        }

        async function requestSolveFromSimulator() {
            showSimulator();
            const target = simulatorFrame.contentWindow;
            if (!target) { logEvent(t('simNotLoaded'), true); setStatus(t('simNotLoaded'), true); return null; }
            if (typeof target.roborubiksGetSolvePath !== 'function') {
                logEvent(t('noSolverApi'), true);
                setStatus(t('refreshPage'), true);
                return null;
            }
            const path = target.roborubiksGetSolvePath();
            console.log('target', target);
            if (!path) {
                logEvent(t('solveNotFound'), true);
                setStatus(t('solveNotFound'), true);
                if (solveOut) solveOut.textContent = '';
                return null;
            }
            if (isSolvedMarker(path)) {
                if (solveOut) solveOut.textContent = t('alreadySolved');
                if (pathInput) pathInput.value = '';
                logEvent(t('alreadySolved'));
                return path;
            }
            if (solveOut) solveOut.textContent = path;
            if (pathInput) pathInput.value = path;
            logEvent(t('solveReceived'));
            setChipOnline();
            return path;
        }

        function inverseMove(move) {
            const m = String(move || '').trim();
            if (!m) return '';
            return m.endsWith("'") ? m.slice(0, -1) : `${m}'`;
        }

        function inversePath(path) {
            const moves = String(path || '')
                .split(/[.\s]+/)
                .map((m) => m.trim())
                .filter(Boolean);
            if (!moves.length) return '';
            return moves.reverse().map(inverseMove).join('.');
        }

        window.addEventListener('message', (event) => {
            if (simulatorFrame.contentWindow && event.source !== simulatorFrame.contentWindow) return;
            if (event.data && event.data.type === 'megaminx_ready') {
                simulatorReady = true;
                flushSimulatorQueue();
            }
        });

        simulatorFrame.addEventListener('load', () => {
            const poll = (attempt) => {
                if (attempt > 40) return;
                const target = simulatorFrame.contentWindow;
                if (target && typeof target.roborubiksReceiveCommand === 'function') {
                    simulatorReady = true;
                    flushSimulatorQueue();
                    return;
                }
                setTimeout(() => poll(attempt + 1), 250);
            };
            poll(0);
        });

        function robotDirectionToSim(direction) {
            if (direction === 1 || direction === '1') return 'cw';
            if (direction === -1 || direction === '-1') return 'ccw';
            return 'cw';
        }

        function movesFromResponse(response) {
            if (!response || !response.move) return [];
            return Array.isArray(response.move) ? response.move : [response.move];
        }

        function syncSimulatorMove(move) {
            if (!move || !move.face) return;
            const face = move.face;
            const dir = robotDirectionToSim(move.direction);
            if (move.direction === 2 || move.direction === '2') {
                sendToSimulator('rotate', { face, direction: 'cw' });
                sendToSimulator('rotate', { face, direction: 'cw' });
                return;
            }
            sendToSimulator('rotate', { face, direction: dir });
        }

        /** Симулятор крутится только по ответам online.py (ход за ходом). */
        function syncSimulatorFromResponse(response) {
            if (response.status !== 'ok') return;
            for (const move of movesFromResponse(response)) {
                syncSimulatorMove(move);
            }
        }

        const rtcConfigurationPromise = fetch('/api/webrtc/ice')
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => (
                data?.iceServers?.length
                    ? { iceServers: data.iceServers }
                    : { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
            ))
            .catch(() => ({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }));

        // Инициализация
        generateFaceStyles();
        setTimeout(generateLegend, 100);
        setTimeout(displayConfig, 200);

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
                if (tab.dataset.tab === 'config') {
                    displayConfig();
                }
            });
        });

        function logEvent(message, isError = false) {
            if (!responseLog) return;
            responseLog.classList.remove('empty-state');
            const time = new Date().toLocaleTimeString(localeTag());
            const entry = document.createElement('div');
            entry.className = 'response-item';
            entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="${isError ? 'response-error' : 'response-success'}">${message}</span>`;
            responseLog.appendChild(entry);
            responseLog.scrollTop = responseLog.scrollHeight;
            while (responseLog.children.length > 50) {
                responseLog.removeChild(responseLog.children[0]);
            }
        }

        function createFacesGrid() {
            const grid = document.getElementById('facesGrid');
            grid.innerHTML = '';
            
            getFaces().forEach(face => {
                const div = document.createElement('div');
                div.className = `face-control face-${face.code}`;
                div.innerHTML = `
                    <div class="face-header">${face.code}</div>
                    <div class="face-buttons">
                        <button class="face-btn face-btn-left" data-face="${face.code}" data-dir="ccw" title="${t('faceTurnCcw', { code: face.code })}">↺</button>
                        <button class="face-btn" data-face="${face.code}" data-dir="cw" title="${t('faceTurnCw', { code: face.code })}">↻</button>
                    </div>
                `;
                grid.appendChild(div);
            });
            
            document.querySelectorAll('.face-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const face = btn.dataset.face;
                    const dir = btn.dataset.dir;
                    sendCommand('rotate', { face, direction: dir });
                    btn.style.transform = 'scale(0.9)';
                    setTimeout(() => btn.style.transform = '', 100);
                });
            });
        }

        function setStatus(text, isError = false) {
            setChip(text, isError);
        }

        function setupApiAccordions() {
            const apiSections = document.querySelectorAll('#tab-api .api-section');
            apiSections.forEach((section, idx) => {
                if (section.dataset.accordionReady === '1') return;
                const titleEl = section.querySelector('.api-title');
                if (!titleEl) return;

                const details = document.createElement('details');
                details.className = 'api-accordion';
                if (idx === 0) details.open = true;

                const summary = document.createElement('summary');
                summary.className = 'api-accordion-summary';
                summary.textContent = titleEl.textContent.trim();
                details.appendChild(summary);

                const body = document.createElement('div');
                body.className = 'api-accordion-body';
                [...section.children].forEach((child) => {
                    if (child !== titleEl) body.appendChild(child);
                });
                details.appendChild(body);

                section.innerHTML = '';
                section.appendChild(details);
                section.dataset.accordionReady = '1';
            });
        }

        let executePathPending = null;
        let lastExecutePathResult = null;
        let dailyChallengeData = null;
        let dailyPhase = 'idle';
        let dailyBusy = false;
        let dailyAttemptId = null;

        function authHeaders() {
            const token = getAuthToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
        }

        function isDailyChallengeFocusMode() {
            return dailyPhase === 'playing' || dailyPhase === 'reveal' || dailyPhase === 'locked';
        }

        function updateDailyChallengeUi() {
            if (controlGrid) {
                controlGrid.classList.toggle('daily-challenge-active', isDailyChallengeFocusMode());
            }
            if (!dailyChallengeStartBtn) return;

            const showSolution =
                dailyPhase === 'reveal' || dailyPhase === 'submitted' || dailyPhase === 'locked';
            if (dailyChallengeDate) {
                if (dailyChallengeData && (dailyPhase !== 'idle' || dailyChallengeData.submitted)) {
                    dailyChallengeDate.hidden = false;
                    dailyChallengeDate.textContent = t('dailyChallengeDate', {
                        date: dailyChallengeData.date,
                        title: dailyChallengeData.title,
                        n: dailyChallengeData.move_count,
                    });
                } else {
                    dailyChallengeDate.hidden = true;
                }
            }

            if (dailyChallengeScramble) {
                if (showSolution && dailyChallengeData?.scramble_path) {
                    dailyChallengeScramble.hidden = false;
                    dailyChallengeScramble.textContent = t('dailyChallengeScramble', {
                        path: dailyChallengeData.scramble_path,
                    });
                } else {
                    dailyChallengeScramble.hidden = true;
                }
            }

            if (dailyChallengeSolution) {
                dailyChallengeSolution.hidden = !showSolution;
            }

            if (dailyChallengeStartBtn) {
                dailyChallengeStartBtn.disabled =
                    dailyBusy || robotResetting || dailyPhase === 'playing';
                dailyChallengeStartBtn.textContent =
                    dailyBusy || dailyPhase === 'playing'
                        ? t('dailyChallengePlaying')
                        : dailyPhase === 'submitted'
                          ? t('dailyChallengeSolveAgain')
                          : dailyPhase === 'locked'
                            ? t('dailyChallengeRestart')
                            : t('dailyChallengeStart');
            }

            if (dailyChallengeSubmitBtn) {
                const canSubmitNow =
                    dailyPhase === 'reveal' && !!dailyAttemptId && !!getAuthToken();
                dailyChallengeSubmitBtn.disabled = dailyBusy || !canSubmitNow;
                dailyChallengeSubmitBtn.textContent = dailyBusy
                    ? t('dailyChallengeVerifying')
                    : t('dailyChallengeSubmit');
            }

            if (dailyChallengeResult) {
                if (dailyPhase === 'locked') {
                    dailyChallengeResult.hidden = false;
                    dailyChallengeResult.className = 'daily-challenge__result daily-challenge__result--err';
                    dailyChallengeResult.textContent = t('dailyChallengeRetryRequired');
                } else if (dailyPhase === 'submitted' && dailyChallengeData?.correct) {
                    dailyChallengeResult.hidden = false;
                    dailyChallengeResult.className = 'daily-challenge__result daily-challenge__result--ok';
                    dailyChallengeResult.textContent = t('dailyChallengeBestTime', {
                        time: formatSolveTimeMs(dailyChallengeData.solve_time_ms),
                    });
                } else if (dailyPhase === 'reveal' && !getAuthToken()) {
                    dailyChallengeResult.hidden = false;
                    dailyChallengeResult.className = 'daily-challenge__result daily-challenge__result--err';
                    dailyChallengeResult.textContent = t('dailyChallengeAuth');
                } else if (dailyChallengeResult.dataset.lastMsg) {
                    dailyChallengeResult.hidden = false;
                } else {
                    dailyChallengeResult.hidden = true;
                }
            }
        }

        function waitMs(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }

        async function waitForRobotResetDone() {
            if (!robotResetting) return;
            await new Promise((resolve) => {
                const handler = ({ resetting }) => {
                    if (!resetting) {
                        socket.off('robot_resetting', handler);
                        resolve();
                    }
                };
                socket.on('robot_resetting', handler);
            });
        }

        async function runGoToInitAndWait() {
            if (robotResetting) {
                setChip(t('dailyChallengeReset'));
                await waitForRobotResetDone();
            }
            let sawResetting = false;
            const done = new Promise((resolve) => {
                const handler = ({ resetting }) => {
                    if (resetting) sawResetting = true;
                    if (!resetting && sawResetting) {
                        socket.off('robot_resetting', handler);
                        resolve();
                    }
                };
                socket.on('robot_resetting', handler);
                setTimeout(() => {
                    socket.off('robot_resetting', handler);
                    resolve();
                }, 600_000);
            });
            setChip(t('dailyChallengeReset'));
            sendCommand('go_to_init');
            await done;
        }

        async function runExecutePathAndWait(path) {
            lastExecutePathResult = null;
            sendCommand('execute_path', { path });
            while (executePathPending) {
                await waitMs(200);
            }
            return lastExecutePathResult;
        }

        function robotTimeToMs(robotTimeSec) {
            if (robotTimeSec == null || !Number.isFinite(Number(robotTimeSec))) return null;
            return Math.round(Number(robotTimeSec) * 1000);
        }

        async function fetchDailyChallengeMeta() {
            const res = await fetch('/api/daily-challenge', { headers: authHeaders() });
            const data = await res.json();
            if (data.status !== 'ok') {
                throw new Error(data.message || t('dailyChallengeFailed'));
            }
            return data;
        }

        async function registerDailyAttempt() {
            const res = await fetch('/api/daily-challenge/attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
            });
            const data = await res.json();
            if (data.status !== 'ok') {
                throw new Error(data.message || t('dailyChallengeFailed'));
            }
            dailyAttemptId = data.attempt_id;
            return data;
        }

        async function lockDailyAttempt() {
            if (!dailyAttemptId) return;
            try {
                await fetch('/api/daily-challenge/lock-attempt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ attempt_id: dailyAttemptId }),
                });
            } catch (_) {
                /* ignore */
            }
            dailyAttemptId = null;
        }

        function applyDailyChallengeMeta(data) {
            dailyChallengeData = data;
            if (data.can_submit && data.attempt_id) {
                dailyAttemptId = data.attempt_id;
                if (dailyPhase !== 'playing') dailyPhase = 'reveal';
            } else if (data.submit_locked) {
                dailyPhase = 'locked';
                dailyAttemptId = null;
            } else if (data.submitted && data.correct) {
                dailyPhase = 'submitted';
                dailyAttemptId = null;
            } else if (dailyPhase !== 'playing' && dailyPhase !== 'reveal') {
                dailyPhase = 'idle';
                dailyAttemptId = null;
            }
        }

        async function refreshDailyChallengeStatus() {
            try {
                const data = await fetchDailyChallengeMeta();
                applyDailyChallengeMeta(data);
                updateDailyChallengeUi();
            } catch (_) {
                /* ignore background refresh */
            }
        }

        async function startDailyChallenge() {
            if (!isActive) {
                logEvent(t('notActiveViewerLog'), true);
                setChip(t('notActiveViewer'), true);
                return;
            }
            if (dailyBusy || dailyPhase === 'playing') {
                logEvent(t('dailyChallengeBusy'), true);
                return;
            }
            if (!getAuthToken()) {
                logEvent(t('dailyChallengeAuth'), true);
                return;
            }

            dailyBusy = true;
            dailyAttemptId = null;
            updateDailyChallengeUi();
            try {
                const data = await fetchDailyChallengeMeta();
                dailyChallengeData = data;
                dailyPhase = 'playing';
                updateDailyChallengeUi();
                logEvent(t('dailyChallengePlaying'));

                await runGoToInitAndWait();
                setChip(t('dailyChallengePlaying'));
                await runExecutePathAndWait(data.scramble_path);
                await registerDailyAttempt();

                dailyPhase = 'reveal';
                if (dailyChallengeResult) dailyChallengeResult.dataset.lastMsg = '';
                logEvent(t('dailyChallengeReveal', { path: data.scramble_path }));
                setChipOnline();
            } catch (err) {
                dailyPhase = 'idle';
                logEvent(err?.message || t('dailyChallengeFailed'), true);
                setChip(err?.message || t('dailyChallengeFailed'), true);
            } finally {
                dailyBusy = false;
                updateDailyChallengeUi();
            }
        }

        const EMBED_TURN_DURATION_MS = 80;

        function estimateSimulatorCatchUpMs(path) {
            const moveCount = String(path || '').split(/[.\s]+/).filter((m) => m.trim()).length;
            return Math.max(3000, moveCount * (EMBED_TURN_DURATION_MS + 20) + 1000);
        }

        async function waitForSimulatorIdle(timeoutMs = 600_000, fallbackMs = 0) {
            showSimulator();
            const target = simulatorFrame.contentWindow;
            if (typeof target?.roborubiksSimulatorIdle !== 'function') {
                if (fallbackMs > 0) {
                    await waitMs(Math.min(fallbackMs, timeoutMs));
                    return true;
                }
                return false;
            }
            const deadline = performance.now() + timeoutMs;
            while (performance.now() < deadline) {
                if (target.roborubiksSimulatorIdle()) return true;
                await waitMs(50);
            }
            return false;
        }

        async function verifySolveStateAfterPath(path) {
            const fallbackMs = estimateSimulatorCatchUpMs(path);
            const timeoutMs = Math.max(30_000, fallbackMs + 5000);
            const idle = await waitForSimulatorIdle(timeoutMs, fallbackMs);
            if (!idle) {
                return { status: 'error', message: t('dailyChallengeSimTimeout') };
            }
            for (let attempt = 0; attempt < 15; attempt++) {
                const result = await computeSolveState(false);
                if (result.status !== 'ok') return result;
                if (result.solved) return result;
                await waitMs(100);
            }
            return computeSolveState(false);
        }

        function formatSolveTimeMs(ms) {
            if (ms == null || !Number.isFinite(Number(ms))) return '—';
            const totalSec = Number(ms) / 1000;
            if (totalSec < 60) return t('secShort', { n: totalSec.toFixed(1) });
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            return t('minSec', { m, s: s.toFixed(1) });
        }

        async function submitDailyChallengeSolution() {
            const path = dailySolutionInput?.value?.trim();
            if (!path) return;
            if (!isActive) {
                logEvent(t('notActiveViewerLog'), true);
                return;
            }
            if (!getAuthToken()) {
                logEvent(t('dailyChallengeAuth'), true);
                updateDailyChallengeUi();
                return;
            }
            if (dailyBusy) return;
            if (dailyPhase !== 'reveal' || !dailyAttemptId) {
                logEvent(t('dailyChallengeRetryRequired'), true);
                updateDailyChallengeUi();
                return;
            }

            dailyBusy = true;
            updateDailyChallengeUi();
            const attemptId = dailyAttemptId;
            try {
                logEvent(t('dailyChallengeExecuting'));
                setChip(t('dailyChallengeExecuting'));
                const execResult = await runExecutePathAndWait(path);
                setChip(t('dailyChallengeSimSync'));

                const solveState = await verifySolveStateAfterPath(path);
                if (solveState.status !== 'ok') {
                    throw new Error(solveState.message || t('error'));
                }
                if (!solveState.solved) {
                    await lockDailyAttempt();
                    dailyPhase = 'locked';
                    if (dailyChallengeResult) {
                        dailyChallengeResult.hidden = false;
                        dailyChallengeResult.dataset.lastMsg = '1';
                        dailyChallengeResult.className = 'daily-challenge__result daily-challenge__result--err';
                        dailyChallengeResult.textContent = t('dailyChallengeRetryRequired');
                    }
                    logEvent(t('dailyChallengeRetryRequired'), true);
                    setChip(t('dailyChallengeRetryRequired'), true);
                    return;
                }

                const solveTimeMs = robotTimeToMs(execResult?.robotTimeSec);

                const res = await fetch('/api/daily-challenge/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({
                        path,
                        solve_time_ms: solveTimeMs,
                        attempt_id: attemptId,
                    }),
                });
                const data = await res.json();
                if (data.status !== 'ok') {
                    if (res.status === 403 || data.locked) {
                        await lockDailyAttempt();
                        dailyPhase = 'locked';
                    }
                    throw new Error(data.message || t('error'));
                }
                if (dailyChallengeResult) {
                    dailyChallengeResult.hidden = false;
                    dailyChallengeResult.dataset.lastMsg = '1';
                    dailyChallengeResult.className = data.correct
                        ? 'daily-challenge__result daily-challenge__result--ok'
                        : 'daily-challenge__result daily-challenge__result--err';
                    dailyChallengeResult.textContent = data.correct
                        ? t('dailyChallengeCorrectTime', {
                            time: formatSolveTimeMs(data.solve_time_ms),
                        })
                        : t('dailyChallengeNotSolved');
                }
                if (data.correct) {
                    dailyPhase = 'submitted';
                    dailyAttemptId = null;
                    if (dailyChallengeData) {
                        dailyChallengeData.submitted = true;
                        dailyChallengeData.correct = true;
                        dailyChallengeData.solve_time_ms = data.solve_time_ms;
                    }
                    logEvent(t('dailyChallengeCorrectTime', {
                        time: formatSolveTimeMs(data.solve_time_ms),
                    }));
                    setChipOnline();
                } else {
                    await lockDailyAttempt();
                    dailyPhase = 'locked';
                    logEvent(t('dailyChallengeRetryRequired'), true);
                    setChip(t('dailyChallengeRetryRequired'), true);
                }
                if (data.improved) {
                    logEvent(t('dailyChallengeImproved', {
                        time: formatSolveTimeMs(data.solve_time_ms),
                    }));
                } else if (data.already_submitted && data.correct && !data.improved) {
                    logEvent(t('dailyChallengeAlready'));
                }
            } catch (err) {
                logEvent(err?.message || t('error'), true);
                setChip(err?.message || t('error'), true);
            } finally {
                dailyBusy = false;
                updateDailyChallengeUi();
            }
        }

        function formatDuration(sec) {
            if (sec == null || !Number.isFinite(Number(sec))) return '—';
            const s = Number(sec);
            if (s < 60) return t('secShort', { n: s.toFixed(1) });
            const m = Math.floor(s / 60);
            return t('minSec', { m, s: (s % 60).toFixed(1) });
        }

        function showExecutePathTiming(html) {
            if (!executePathTiming) return;
            executePathTiming.innerHTML = html;
            executePathTiming.hidden = false;
        }

        function clearExecutePathTiming() {
            if (!executePathTiming) return;
            executePathTiming.innerHTML = '';
            executePathTiming.hidden = true;
        }

        function sendCommand(command, params = {}, options = {}) {
            if (!isActive) { logEvent(t('notActiveViewerLog'), true); setChip(t('notActiveViewer'), true); return; }
            if ((command !== 'set_stickers' && command !== 'set_face_colors' && command !== 'set_piece_colors') || !options.simulatorOnly) {
                socket.emit('command', { command, params });
            }

            if (command === 'set_stickers' || command === 'set_face_colors' || command === 'set_piece_colors') {
                sendToSimulator(command, params);
            } else if (command === 'go_to_init') {
                // Сброс очереди анимации; ходы — только из progress/move от робота
                sendToSimulator('go_to_init', {});
            }
            // rotate / execute_path — в симулятор только после ответов online.py

            if (command === 'execute_path') {
                executePathPending = {
                    path: params.path || '',
                    start: performance.now(),
                    moveCount: 0,
                    lastMoveAt: null,
                };
                clearExecutePathTiming();
            }

            let display = command === 'rotate' ? `${params.face}${params.direction === 'cw' ? '' : "'"}` : command;
            if (command === 'execute_path' && params.path) {
                display = t('executePathLog', { n: params.path.split('.').filter(Boolean).length });
            }
            logEvent(display);

        }

        function updateHistoryList(history) {
            if (!history || history.length === 0) {
                historyList.innerHTML = t('historyEmpty');
                historyList.classList.add('empty-state');
                currentPath = '';
                return;
            }
            historyList.classList.remove('empty-state');
            const moves = history.map(m => `${m.face}${m.direction === 1 ? '' : "'"}`);
            currentPath = moves.join('.');
            
            let html = '';
            for (let i = 0; i < moves.length; i += 10) {
                html += `<div class="history-item">${i+1}-${Math.min(i+10, moves.length)}: ${moves.slice(i, i+10).join(' ')}</div>`;
            }
            historyList.innerHTML = html;
        }

        async function createPeerConnection() {
            const configuration = await rtcConfigurationPromise;
            const pc = new RTCPeerConnection(configuration);
            pc.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', e.candidate); };
            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'connected') {
                    setChipOnline();
                    controlPanel.style.display = 'block';
                    updateLayoutMode();
                    createFacesGrid();
                } else if (pc.iceConnectionState === 'failed') {
                    setChip(t('connectionError'), true);
                    controlPanel.style.display = 'none';
                    updateLayoutMode();
                }
            };
            pc.ontrack = e => {
                remoteVideo.srcObject = e.streams[0];
                setVideoPlaceholderVisible(false);
                setChipOnline();
            };
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                    setChip(t('connectionLost'), true);
                    remoteVideo.srcObject = null;
                    setVideoPlaceholderVisible(true);
                    controlPanel.style.display = 'none';
                    updateLayoutMode();
                }
            };
            return pc;
        }

        function setAuthMode(mode) {
            if (mode === 'register' && !registrationEnabled) mode = 'login';
            authMode = mode === 'register' ? 'register' : 'login';
            if (authTabLogin) {
                authTabLogin.classList.toggle('active', authMode === 'login');
                authTabLogin.setAttribute('aria-selected', authMode === 'login' ? 'true' : 'false');
            }
            if (authTabRegister) {
                authTabRegister.classList.toggle('active', authMode === 'register');
                authTabRegister.setAttribute('aria-selected', authMode === 'register' ? 'true' : 'false');
            }
            if (authTabs) {
                authTabs.classList.toggle('is-single', !registrationEnabled);
            }
            const showLogin = authMode === 'login';
            const showRegister = authMode === 'register' && registrationEnabled;
            if (authForm) authForm.hidden = !showLogin;
            if (registerForm) registerForm.hidden = !showRegister;
            if (authTitle) {
                authTitle.textContent = t(authMode === 'register' ? 'authTitleRegister' : 'authTitle');
            }
            if (authLead) {
                authLead.textContent = t(authMode === 'register' ? 'authLeadRegister' : 'authLead');
            }
            if (authError) authError.hidden = true;
            if (authSuccess) authSuccess.hidden = true;
        }

        function showAuthPanel(mode = 'login') {
            if (authShell) authShell.hidden = false;
            if (landingControls) landingControls.style.display = 'none';
            document.body.classList.add('viewer-needs-auth');
            setAuthMode(mode);
        }

        function hideAuthPanel() {
            if (authShell) authShell.hidden = true;
            if (landingControls) landingControls.style.display = '';
            document.body.classList.remove('viewer-needs-auth');
            updateLogoutButton();
        }

        function handleAuthFailure(message) {
            setAuthToken('');
            viewerAuthed = false;
            socket.auth = { token: '' };
            updateLogoutButton();
            if (authRequired) {
                showAuthPanel();
                if (authError) {
                    authError.textContent = message || t('authError');
                    authError.hidden = false;
                }
            }
        }

        async function logoutViewer() {
            const token = getAuthToken();
            if (isInQueue) leaveQueue();
            try {
                if (token) {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ token }),
                    });
                }
            } catch (_) { /* ignore */ }

            setAuthToken('');
            viewerAuthed = false;
            socket.auth = { token: '' };
            if (socket.connected) socket.disconnect();
            socket.connect();
            updateLogoutButton();
            if (authRequired) {
                showAuthPanel('login');
            }
            setChip(t('waiting'));
            logEvent(t('authLogoutLog'));
        }

        async function loadAuthConfig() {
            try {
                const res = await fetch('/api/auth/config');
                const data = await res.json();
                authRequired = !!data.authRequired;
                registrationEnabled = !!data.registrationEnabled;
                if (authTabs) {
                    authTabs.classList.toggle('is-single', !registrationEnabled);
                }
                if (!authRequired) {
                    viewerAuthed = true;
                    hideAuthPanel();
                    updateLogoutButton();
                    return;
                }
                if (getAuthToken()) {
                    viewerAuthed = true;
                    hideAuthPanel();
                } else {
                    showAuthPanel('login');
                }
                updateLogoutButton();
            } catch (_) {
                viewerAuthed = true;
                hideAuthPanel();
                updateLogoutButton();
            }
        }

        async function loginViewer(username, password) {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || t('authError'));
            }
            setAuthToken(data.token);
            viewerAuthed = true;
            socket.auth = { token: data.token };
            if (socket.connected) socket.disconnect();
            socket.connect();
            if (authError) authError.hidden = true;
            if (authSuccess) authSuccess.hidden = true;
            hideAuthPanel();
        }

        async function registerViewer(username, password) {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || t('authRegisterDisabled'));
            }
            return data;
        }

        if (authTabLogin) {
            authTabLogin.addEventListener('click', () => setAuthMode('login'));
        }
        if (authTabRegister) {
            authTabRegister.addEventListener('click', () => setAuthMode('register'));
        }

        if (authForm) {
            authForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (authError) authError.hidden = true;
                if (authSuccess) authSuccess.hidden = true;
                try {
                    await loginViewer(authUsername?.value || '', authPassword?.value || '');
                    if (authPassword) authPassword.value = '';
                } catch (err) {
                    if (authError) {
                        authError.textContent = err.message || t('authError');
                        authError.hidden = false;
                    }
                }
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (authError) authError.hidden = true;
                if (authSuccess) authSuccess.hidden = true;
                try {
                    await registerViewer(registerUsername?.value || '', registerPassword?.value || '');
                    if (authSuccess) {
                        authSuccess.textContent = t('authRegisterOk');
                        authSuccess.hidden = false;
                    }
                    if (authUsername && registerUsername) {
                        authUsername.value = registerUsername.value;
                    }
                    if (registerPassword) registerPassword.value = '';
                    setAuthMode('login');
                } catch (err) {
                    if (authError) {
                        authError.textContent = err.message || t('authRegisterDisabled');
                        authError.hidden = false;
                    }
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => logoutViewer());
        }

        window.addEventListener('viewer:langchange', () => {
            if (authShell && !authShell.hidden) setAuthMode(authMode);
        });

        function refreshQueueMessage(pos = lastQueuePosition) {
            if (!isInQueue || isActive) return;
            if (robotResetting) {
                queueMessageEl.innerText = t('queueResetting');
                setChip(t('queueResetting'));
                return;
            }
            if (pos === 1) {
                queueMessageEl.innerText = t('queueNext');
                setChip(t('queueFirst'));
            } else if (pos > 1) {
                const before = pos - 1;
                queueMessageEl.innerText = t('queueBefore', {
                    n: before,
                    people: window.viewerI18n.peopleWord(before),
                });
                setChip(t('queuePosition', { n: pos }));
            }
        }

        function joinQueue() {
            if (robotResetting) {
                logEvent(t('robotResettingError'), true);
                setChip(t('queueResetting'), true);
                return;
            }
            if (authRequired && !viewerAuthed) {
                showAuthPanel();
                logEvent(t('authRequiredLog'), true);
                return;
            }
            socket.emit('register as viewer');
            joinBtn.style.display = 'none';
            leaveBtn.style.display = 'block';
            isInQueue = true;
            setWelcomeVisible(false);
            updateLayoutMode();
            setChip(t('inQueue'));
            logEvent(t('joinedQueue'));
        }

        function leaveQueue() {
            const wasActive = isActive;
            if (wasActive && socket.connected) {
                socket.emit('command', { command: 'go_to_init', params: {} });
            }
            if (peerConnection) { peerConnection.close(); peerConnection = null; }
            socket.disconnect();
            setTimeout(() => socket.connect(), 100);
            joinBtn.style.display = 'block';
            leaveBtn.style.display = 'none';
            controlPanel.style.display = 'none';
            updateLayoutMode();
            isInQueue = isActive = false;
            remoteVideo.srcObject = null;
            setVideoPlaceholderVisible(true);
            setWelcomeVisible(true);
            hideSimulator();
            setChip(t('waiting'));
            logEvent(wasActive ? t('leaveQueueGoToInit') : t('leftQueue'));
        }

        updateLayoutMode();

        joinBtn.onclick = joinQueue;
        leaveBtn.onclick = leaveQueue;
        if (solveBtn) solveBtn.onclick = requestSolveFromSimulator;

        socket.on('queue position', pos => {
            lastQueuePosition = pos;
            queuePositionEl.innerText = pos;
            refreshQueueMessage(pos);
        });

        socket.on('robot_resetting', ({ resetting }) => {
            robotResetting = !!resetting;
            if (joinBtn) joinBtn.disabled = robotResetting;
            refreshQueueMessage(lastQueuePosition);
            updateDailyChallengeUi();
        });

        socket.on('you are active', async () => {
            isActive = true;
            updateLayoutMode();
            showSimulator();
            setChip(t('connecting'));
            peerConnection = await createPeerConnection();
            refreshDailyChallengeStatus();
        });

        socket.on('offer', async offer => {
            if (!isActive) return;
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.emit('answer', peerConnection.localDescription);
            } catch (err) { console.error(err); }
        });

        socket.on('ice-candidate', candidate => {
            if (peerConnection) peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
        });

        socket.on('broadcaster offline', () => {
            setChip(t('streamerOffline'), true);
            logEvent(t('streamerOffline'), true);
            if (isInQueue) leaveQueue();
        });

        socket.on('error', msg => {
            const text = String(msg || '');
            if (text.includes('начальное состояние') || text.toLowerCase().includes('resetting')) {
                robotResetting = true;
                if (joinBtn) joinBtn.disabled = true;
                setChip(t('queueResetting'), true);
            }
            if (text.includes('авторизац') || text.toLowerCase().includes('auth')) {
                handleAuthFailure(text);
            }
            setChip(text, true);
            logEvent(text, true);
            if (text.includes('офлайн') || text.toLowerCase().includes('offline')) leaveQueue();
        });

        fetch('/health')
            .then((r) => r.json())
            .then((data) => {
                if (data.robotResetting) {
                    robotResetting = true;
                    if (joinBtn) joinBtn.disabled = true;
                }
            })
            .catch(() => {});

        loadAuthConfig();

        socket.on('apply_face_colors', params => {
            if (params) paintSimulatorFromScan(params);
            logEvent(t('simRepainted'));
        });

        socket.on('request_solve_state', async () => {
            try {
                if (!isActive) {
                    socket.emit('solve_state_response', { status: 'error', message: t('viewerNotActive') });
                    return;
                }
                console.log('[Viewer] request_solve_state → solver');
                await waitForSimulatorIdle(120_000);
                const result = await computeSolveState(false);
                socket.emit('solve_state_response', result);
            } catch (err) {
                console.error('[Viewer] request_solve_state failed:', err);
                socket.emit('solve_state_response', {
                    status: 'error',
                    message: err?.message || String(err),
                });
            }
        });

        socket.on('command_response', response => {
            console.log('Ответ:', response);

            if (response.progress) {
                syncSimulatorFromResponse(response);
                if (executePathPending) {
                    executePathPending.moveCount += 1;
                    executePathPending.lastMoveAt = performance.now();
                    const notation = response.move?.notation || '';
                    setChip(t('executingMove', { n: executePathPending.moveCount }));
                }
                return;
            }

            syncSimulatorFromResponse(response);

            const scanPayload = {
                faces: response.faces || response.state?.faces,
                stickers: response.stickers || response.state?.stickers,
            };
            if (scanPayload.stickers?.length || scanPayload.faces) {
                paintSimulatorFromScan(scanPayload);
            }

            const isExecutePathDone =
                executePathPending &&
                (response.command === 'execute_path' ||
                    (response.executed != null && response.time != null && !response.reverse_path));

            let text = '';
            if (response.status === 'ok') {
                if (isExecutePathDone) {
                    const totalSec = (performance.now() - executePathPending.start) / 1000;
                    const lastMoveSec = executePathPending.lastMoveAt
                        ? (executePathPending.lastMoveAt - executePathPending.start) / 1000
                        : null;
                    const executed = response.executed ?? executePathPending.moveCount;
                    text = t('executePathDone', { n: executed });
                    const timingParts = [t('timingRobot', { time: formatDuration(response.time) })];
                    if (lastMoveSec != null) {
                        timingParts.push(t('timingLastMove', { time: formatDuration(lastMoveSec) }));
                    }
                    timingParts.push(t('timingSinceSend', { time: formatDuration(totalSec) }));
                    text += ` · ${timingParts.join(' · ')}`;
                    showExecutePathTiming(
                        `<strong>${t('timingTitle')}</strong><br>` +
                        `${t('timingRobotLabel')} <strong>${formatDuration(response.time)}</strong><br>` +
                        (lastMoveSec != null
                            ? `${t('timingLastMoveLabel')} <strong>${formatDuration(lastMoveSec)}</strong><br>`
                            : '') +
                        `${t('timingSinceSendLabel')} <strong>${formatDuration(totalSec)}</strong>`
                    );
                    lastExecutePathResult = {
                        robotTimeSec: response.time,
                        executed: response.executed ?? executePathPending.moveCount,
                        ok: true,
                    };
                    executePathPending = null;
                } else if (scanPayload.stickers?.length || scanPayload.faces) {
                    text = t('scanOk');
                } else if (response.move) {
                    text = response.move.notation;
                } else if (response.history) {
                    text = t('historyOk', { n: response.history.length });
                } else if (response.state) {
                    text = t('stateOk', { n: response.state.history_length });
                } else if (response.path && response.reverse_path) {
                    text = t('pathOk', { n: response.path.split('.').filter(Boolean).length });
                    currentPath = response.path;
                    pathInput.value = response.path;
                } else if (response.reverse_path) {
                    text = t('reversePathOk', { path: response.reverse_path });
                    pathInput.value = response.reverse_path;
                    if (solveOut) solveOut.textContent = response.reverse_path;
                } else if (response.message) {
                    text = response.message;
                } else {
                    text = 'OK';
                }
                logEvent(text, false);
            } else {
                if (executePathPending) {
                    const elapsed = (performance.now() - executePathPending.start) / 1000;
                    const errMsg = response.message || response.error || t('error');
                    text = t('executePathErr', { msg: errMsg, time: formatDuration(elapsed) });
                    if (response.time != null) {
                        text += ` · ${t('timingRobot', { time: formatDuration(response.time) })}`;
                    }
                    lastExecutePathResult = {
                        robotTimeSec: response.time ?? null,
                        executed: executePathPending.moveCount,
                        ok: false,
                    };
                    executePathPending = null;
                } else {
                    text = response.message || response.error || t('error');
                }
                logEvent(text, true);
            }

            if (response.status === 'ok' && !response.progress) {
                setChipOnline();
            }

            if (response.history) {
                updateHistoryList(response.history);
            }
        });

        // Обработчики кнопок (безопасная привязка — отсутствующие id не ломают остальные)
        bindClick('executePathBtn', () => {
            const path = pathInput.value.trim();
            if (path) sendCommand('execute_path', { path });
        });

        bindClick('reversePathBtn', () => {
            sendCommand('get_reverse_path');
        });

        bindClick('goToInitBtn', () => {
            if (confirm(t('confirmGoToInit'))) sendCommand('go_to_init');
        });

        bindClick('getStateBtn', async () => {
            await requestReversePathFromSimulator();
        });

        bindClick('motorTestBtn', () => {
            sendCommand('test');
        });

        bindClick('getHistoryBtn', () => {
            sendCommand('get_history');
        });

        bindClick('dailyChallengeStartBtn', () => {
            startDailyChallenge();
        });

        bindClick('dailyChallengeSubmitBtn', () => {
            submitDailyChallengeSolution();
        });

        if (apiTokenCopyBtn) apiTokenCopyBtn.addEventListener('click', copyApiToken);
        if (apiTokenRevealBtn) apiTokenRevealBtn.addEventListener('click', toggleApiTokenVisibility);

        bindClick('copyPathBtn', async () => {
            const localPath = getPathText();
            if (localPath) {
                await copyPathToClipboard();
                return;
            }
            if (!isActive) {
                logEvent(t('joinQueueFirst'), true);
                setChip(t('notActiveViewer'), true);
                return;
            }
            sendCommand('get_path');
        });

       


        window.addEventListener('beforeunload', e => {
            if (isInQueue) { e.preventDefault(); e.returnValue = t('beforeUnload'); }
        });

        window.addEventListener('viewer:langchange', () => {
            if (window.viewerConfig?.rebuild) window.viewerConfig.rebuild();
            createFacesGrid();
            if (historyList?.classList.contains('empty-state')) {
                historyList.textContent = t('historyEmpty');
            }
            if (responseLog?.classList.contains('empty-state')) {
                responseLog.textContent = t('logEmpty');
            }
            displayConfig();
            if (solveOut && isSolvedMarker(solveOut.textContent)) {
                solveOut.textContent = t('alreadySolved');
            }
            syncSimulatorLang();
            updateDailyChallengeUi();
            updateApiTokenPanel();
        });

        updateApiTokenPanel();
