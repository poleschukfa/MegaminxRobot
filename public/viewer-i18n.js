(function initViewerI18n(global) {
    const FACE_NAMES = {
        U: { ru: 'Верх', en: 'Up' },
        D: { ru: 'Низ', en: 'Down' },
        F: { ru: 'Перед', en: 'Front' },
        B: { ru: 'Зад', en: 'Back' },
        L: { ru: 'Лево', en: 'Left' },
        R: { ru: 'Право', en: 'Right' },
        BL: { ru: 'Зад-Лево', en: 'Back-Left' },
        BR: { ru: 'Зад-Право', en: 'Back-Right' },
        FL: { ru: 'Перед-Лево', en: 'Front-Left' },
        FR: { ru: 'Перед-Право', en: 'Front-Right' },
        DL: { ru: 'Низ-Лево', en: 'Down-Left' },
        DR: { ru: 'Низ-Право', en: 'Down-Right' },
    };

    const STRINGS = {
        ru: {
            pageTitle: 'Управление роботом, собирающим мегаминкс | Roborubiks',
            indexPageTitle: 'Roborubiks — управление роботом, собирающим мегаминкс',
            indexBadge: 'Онлайн · Roborubiks',
            indexTitle: 'Создание робота для сборки головоломки Мегаминкс',
            indexLead: 'Проект МФТИ: робот для сборки мегаминкса, онлайн-симулятор и соревнование алгоритмов.',
            indexJoinBtn: 'Перейти к управлению роботом',
            indexChecking: 'Проверяем статус робота…',
            indexRobotOnline: 'Робот онлайн',
            indexRobotOffline: 'Робот офлайн',
            indexQueueCount: 'В очереди: {n}',
            indexAboutTitle: 'Что это за проект',
            indexAboutText: 'Это открытая платформа для наблюдения за роботом, тестирования алгоритмов и удаленного управления сборкой.',
            indexAboutGoal: 'Проект объединяет инженеров, математиков и разработчиков, чтобы сократить время роботической сборки и подготовить попытку мирового рекорда.',
            indexFactsTitle: 'Почему мегаминкс сложен',
            indexFact1: '12 граней и 50 подвижных элементов дают пространство состояний порядка 10^68.',
            indexFact2: 'Скорость человека пока существенно выше: 22.89 с против роботического ориентира около 8 минут.',
            indexFact3: 'Задача требует одновременно точной механики и сильного поиска путей в огромном графе состояний.',
            indexFact4: 'Робот МФТИ использует 12 независимых актуаторов для вращения граней без переворота головоломки.',
            indexFactsSource: 'Подробнее в презентации проекта',
            indexMetricsTitle: 'Ключевые цифры',
            indexMetricStates: 'порядок числа состояний мегаминкса',
            indexMetricHuman: 'значение из презентации проекта',
            indexMetricRobot: 'исторический ориентир для робота',
            indexMetricBudget: 'бюджет проекта',
            indexVisualsTitle: 'Инфографика и мегаминкс',
            indexInfographicTitle: 'Сравнение сложности и рекордов',
            indexHowTitle: 'Как принять участие',
            indexHow1: 'Подключитесь к очереди на управление.',
            indexHow2: 'Когда вы станете активным зрителем, откроются видео и пульт.',
            indexHow3: 'Запускайте свои последовательности ходов и проверяйте результат в симуляторе.',
            indexHow4: 'Сравнивайте решения и готовьтесь к хакатону и финальному этапу.',
            indexLinksTitle: 'Полезные ссылки',
            indexLinkPresentation: 'Презентация проекта',
            indexLinkThanks: 'Благодарность Фонду целевого капитала МФТИ',
            indexTimelineTitle: 'Хронология проекта',
            indexTimeline1: 'Ноябрь–январь: конструирование робота и интеграция с симулятором.',
            indexTimeline2: 'Февраль–март: мини-курс и онлайн-этап хакатона по алгоритмам сборки.',
            indexTimeline3: 'Апрель–май: финал на физическом роботе и попытка мирового рекорда.',
            indexSponsorsTitle: 'Партнёры',
            indexMegaminxAlt: 'Мегаминкс — головоломка проекта',
            langRu: 'RU',
            langEn: 'EN',
            joinBtn: 'Встать в очередь',
            leaveBtn: 'Покинуть очередь',
            authTabLogin: 'Вход',
            authTabRegister: 'Регистрация',
            authTitle: 'Вход для управления',
            authTitleRegister: 'Регистрация',
            authLead: 'Войдите в аккаунт, чтобы встать в очередь и управлять роботом.',
            authLeadRegister: 'Создайте аккаунт для доступа к управлению роботом.',
            authUsernameLabel: 'Логин',
            authUsernamePlaceholder: 'your_login',
            authUsernameHint: '3–32 символа: латиница, цифры и _',
            authPasswordLabel: 'Пароль',
            authPasswordPlaceholder: 'Пароль',
            authRegisterPasswordPlaceholder: 'Минимум 8 символов',
            authSubmit: 'Войти',
            authRegisterSubmit: 'Создать аккаунт',
            authError: 'Неверный логин или пароль',
            authRegisterOk: 'Аккаунт создан. Теперь войдите.',
            authRegisterDisabled: 'Регистрация отключена',
            authRequiredLog: 'Сначала войдите для управления',
            authLogout: 'Выход',
            authLogoutLog: 'Вы вышли из аккаунта',
            landingBadge: 'Онлайн · Roborubiks',
            landingTitle: 'Управляйте роботом, собирающим мегаминкс, в реальном времени',
            landingLead: 'Встаньте в очередь, станьте активным зрителем и крутите грани настоящего робота через браузер.',
            landingStep1: 'Нажмите «Встать в очередь»',
            landingStep2: 'Дождитесь своей очереди',
            landingStep3: 'Управляйте гранями или отправьте путь',
            landingApiLink: 'Документация API',
            welcomeHtml: '<strong>Как начать:</strong> очередь → активный зритель → управление гранями или путь',
            queueLabel: 'ваша позиция в очереди',
            queueMessageDefault: 'Подключаемся…',
            videoLabel: 'Трансляция',
            videoPlaceholder: 'Видео появится, когда вы станете активным зрителем',
            simulatorLabel: 'Симулятор',
            videoSectionAria: 'Трансляция и симулятор',
            controlPanelAria: 'Пульт управления',
            quickActions: 'Быстрые действия',
            motorTest: 'Тест моторов',
            solve: 'Решить',
            tabControl: 'Управление',
            tabApi: 'API',
            pathTitle: 'Путь (нотация)',
            pathHint: 'Пример: <code>U.F.R\'.BL</code>',
            executePath: 'Выполнить путь',
            goToInit: 'Собрать обратно',
            getState: 'Состояние',
            historyTitle: 'История',
            refreshHistory: 'Обновить',
            copyPath: 'Копировать',
            historyEmpty: 'Пока нет ходов — крутите грани или выполните путь',
            logTitle: 'Журнал событий',
            logEmpty: 'Команды и ответы робота — здесь',
            apiTitle: 'Python API',
            apiText: 'Управляйте роботом из Jupyter или скриптов — класс <code>MegaminxClient</code>.',
            apiDocs: 'Документация API',
            apiNotebook: 'Jupyter notebook',
            apiClient: 'megaminx_client.py',
            apiColab: 'Открыть в Google Colab',
            apiTokenTitle: 'Токен для API',
            apiTokenHint: 'Скопируйте токен сессии для запросов из Python или curl. Работает, пока вы вошли в аккаунт. Для команд робота нужен активный зритель в очереди.',
            apiTokenReveal: 'Показать',
            apiTokenHide: 'Скрыть',
            apiTokenCopied: 'Токен скопирован',
            apiTokenNoAuth: 'Авторизация отключена — HTTP API доступен без токена (или используйте серверный API_SECRET).',
            apiTokenExamplePy: 'MegaminxClient(api_token="…")',
            configTitle: 'Конфигурация граней',
            configNote: 'Измените <code>faceConfig</code> в <code>viewer-config.js</code> и обновите страницу.',
            configCurrent: 'Текущая конфигурация:',
            configExample: '// см. viewer-config.js',
            copyCode: 'Копировать',
            connected: 'Подключено',
            waiting: 'Ожидание',
            inQueue: 'В очереди…',
            joinedQueue: 'Встали в очередь',
            leftQueue: 'Покинули очередь',
            leaveQueueGoToInit: 'Покинули очередь — робот возвращается в начальное состояние',
            queueResetting: 'Робот возвращается в начальное состояние — подождите',
            robotResettingError: 'Робот возвращается в начальное состояние. Подождите.',
            queueNext: 'Скоро подключим — вы следующие!',
            queueBefore: 'Перед вами {n} {people}',
            queuePeople1: 'человек',
            queuePeople2: 'человека',
            queuePeople5: 'человек',
            queueFirst: 'Вы первые в очереди',
            queuePosition: 'Позиция {n}',
            connecting: 'Подключение…',
            connectingTitle: 'Подключение к роботу',
            connectingHint: 'Настраиваем видео и пульт управления…',
            waitingQueue: 'Ожидание в очереди…',
            connectionError: 'Ошибка подключения',
            connectionLost: 'Соединение потеряно',
            streamerOffline: 'Стример офлайн',
            notActiveViewer: 'Не активный зритель',
            notActiveViewerLog: 'Вы не активный зритель',
            simNotLoaded: 'Симулятор не загружен',
            noSolverApi: 'Нет solver API в симуляторе',
            noSolverApiLong: 'В симуляторе нет solver API (обновите страницу)',
            refreshPage: 'Обновите страницу',
            solveNotFound: 'Решение не найдено',
            solveNotFoundLong: 'Решение не найдено (возможно, состояние некорректное)',
            alreadySolved: 'уже собрано',
            solveReceived: 'Решение получено',
            reversePathFailed: 'Не удалось построить обратный путь',
            noPathToCopy: 'Нет пути для копирования',
            pathCopied: 'Путь скопирован: {path}',
            pathCopiedManual: 'Путь скопирован (выделите вручную)',
            copiedBtn: 'Скопировано!',
            joinQueueFirst: 'Сначала встаньте в очередь',
            confirmGoToInit: 'Собрать мегаминкс обратно?',
            beforeUnload: 'Потеряете очередь!',
            viewerNotActive: 'Зритель не активен',
            simRepainted: 'Симулятор синхронизирован с роботом',
            executingMove: 'Выполнение… ход {n}',
            executePathLog: 'execute_path ({n} ходов)',
            error: 'Ошибка',
            faceTurnCcw: '{code} против часовой ({code}\')',
            faceTurnCw: '{code} по часовой ({code})',
            executePathDone: 'execute_path: {n} ходов',
            timingRobot: 'робот {time}',
            timingLastMove: 'до последнего хода {time}',
            timingSinceSend: 'с отправки {time}',
            timingTitle: 'Время execute_path',
            timingRobotLabel: 'Робот (моторы):',
            timingLastMoveLabel: 'До последнего хода:',
            timingSinceSendLabel: 'С момента отправки:',
            scanOk: 'Симулятор синхронизирован с роботом',
            historyOk: 'История ходов: {n}',
            stateOk: 'Состояние: выполнено {n} ходов',
            pathOk: 'Путь: {n} ходов',
            reversePathOk: 'Обратный путь: {path}',
            executePathErr: 'execute_path: {msg} (через {time})',
            secShort: '{n} с',
            minSec: '{m}м {s} с',
            dailyChallengeTitle: 'Дейли-челлендж',
            dailyChallengeHint: 'Каждый день один и тот же случайный путь из 500 ходов для всех. Робот перемешает из начала — отправьте решение.',
            dailyChallengeStart: 'Начать челлендж',
            dailyChallengeRestart: 'Повторить челлендж',
            dailyChallengeRetryRequired: 'Решение не принято. Нажмите «Повторить челлендж» (go_to_init → перемешивание), затем отправьте снова.',
            dailyChallengePlaying: 'Дейли-челлендж: робот перемешивает…',
            dailyChallengeReset: 'Возврат в начало…',
            dailyChallengeScramble: 'Перемешивание: {path}',
            dailyChallengeReveal: 'Челлендж готов — решите путь: {path}',
            dailyChallengeDate: '{date} · {title} · {n} ходов',
            dailyChallengeSolutionLabel: 'Ваше решение',
            dailyChallengeSubmit: 'Отправить решение',
            dailyChallengeCorrect: 'Верно! Решение принято.',
            dailyChallengeCorrectTime: 'Робот собрал за {time}!',
            dailyChallengeWrong: 'Неверное решение. Попробуйте ещё раз.',
            dailyChallengeNotSolved: 'Мегаминкс не собран — проверьте путь',
            dailyChallengeExecuting: 'Выполняем решение на роботе…',
            dailyChallengeSimSync: 'Синхронизируем симулятор…',
            dailyChallengeSimTimeout: 'Симулятор не успел догнать робота — подождите и попробуйте снова',
            dailyChallengeVerifying: 'Проверяем…',
            dailyChallengeLeaderboard: 'Таблица лидеров',
            dailyChallengeAlready: 'У вас уже есть лучшее время за сегодня.',
            leaderboardTitle: 'Таблица лидеров — дейли-челлендж',
            leaderboardLead: 'Кто быстрее собрал сегодняшний scramble. Время — только работа робота (execute_path решения).',
            leaderboardDate: 'Дата',
            leaderboardEmpty: 'Пока никто не решил этот день.',
            leaderboardRank: '#',
            leaderboardUser: 'Игрок',
            leaderboardTime: 'Время робота',
            leaderboardMoves: 'Ходов',
            leaderboardBack: 'К управлению',
            leaderboardHome: 'На главную',
            leaderboardLoading: 'Загрузка…',
            dailyChallengeAuth: 'Войдите в аккаунт, чтобы отправить решение',
            dailyChallengeBusy: 'Челлендж уже выполняется…',
            dailyChallengeDone: 'Сегодняшний челлендж решён!',
            dailyChallengeSolveAgain: 'Решить снова',
            dailyChallengeBestTime: 'Лучшее время сегодня: {time}',
            dailyChallengeImproved: 'Новый рекорд: {time}!',
            dailyChallengeFailed: 'Не удалось запустить челлендж',
        },
        en: {
            pageTitle: 'Megaminx-solving robot control | Roborubiks',
            indexPageTitle: 'Roborubiks — control the robot assembling Megaminx',
            indexBadge: 'Live · Roborubiks',
            indexTitle: 'Megaminx Puzzle Solving Robot Project',
            indexLead: 'MIPT project: a Megaminx-solving robot, an online simulator, and an algorithm competition.',
            indexJoinBtn: 'Open robot controls',
            indexChecking: 'Checking robot status…',
            indexRobotOnline: 'Robot online',
            indexRobotOffline: 'Robot offline',
            indexQueueCount: 'In queue: {n}',
            indexAboutTitle: 'What this project is',
            indexAboutText: 'An open platform to watch the robot, test algorithms, and control solving through a web interface.',
            indexAboutGoal: 'The project unites engineers, mathematicians, and developers to reduce robot solve time and prepare a world-record attempt.',
            indexFactsTitle: 'Why Megaminx is hard',
            indexFact1: '12 faces and 50 moving parts create a state space on the order of 10^68.',
            indexFact2: 'Humans are still much faster: 22.89 s versus a robot benchmark around 8 minutes.',
            indexFact3: 'The task needs both precise mechanics and strong path-search in a massive state graph.',
            indexFact4: 'The MIPT robot uses 12 independent actuators to rotate faces without flipping the puzzle.',
            indexFactsSource: 'Read more in the project presentation',
            indexMetricsTitle: 'Key figures',
            indexMetricStates: 'order of Megaminx state space',
            indexMetricHuman: 'value from project presentation',
            indexMetricRobot: 'historic robot benchmark',
            indexMetricBudget: 'project budget',
            indexVisualsTitle: 'Infographic and Megaminx',
            indexInfographicTitle: 'Complexity and records comparison',
            indexHowTitle: 'How to participate',
            indexHow1: 'Join the control queue.',
            indexHow2: 'When you become the active viewer, live video and controls appear.',
            indexHow3: 'Run your move sequences and validate results in the simulator.',
            indexHow4: 'Compare solutions and prepare for the hackathon and final stage.',
            indexLinksTitle: 'Useful links',
            indexLinkPresentation: 'Project presentation',
            indexLinkThanks: 'Acknowledgment to the MIPT Endowment Fund',
            indexTimelineTitle: 'Project timeline',
            indexTimeline1: 'Nov–Jan: robot construction and simulator integration.',
            indexTimeline2: 'Feb–Mar: mini-course and online hackathon stage for solving algorithms.',
            indexTimeline3: 'Apr–May: physical final and world-record attempt.',
            indexSponsorsTitle: 'Partners',
            indexMegaminxAlt: 'Megaminx puzzle used in the project',
            langRu: 'RU',
            langEn: 'EN',
            joinBtn: 'Join queue',
            leaveBtn: 'Leave queue',
            authTabLogin: 'Sign in',
            authTabRegister: 'Register',
            authTitle: 'Sign in to control',
            authTitleRegister: 'Create account',
            authLead: 'Sign in to join the queue and control the robot.',
            authLeadRegister: 'Create an account to access robot controls.',
            authUsernameLabel: 'Username',
            authUsernamePlaceholder: 'your_login',
            authUsernameHint: '3–32 characters: letters, digits and _',
            authPasswordLabel: 'Password',
            authPasswordPlaceholder: 'Password',
            authRegisterPasswordPlaceholder: 'At least 8 characters',
            authSubmit: 'Sign in',
            authRegisterSubmit: 'Create account',
            authError: 'Wrong username or password',
            authRegisterOk: 'Account created. You can sign in now.',
            authRegisterDisabled: 'Registration is disabled',
            authRequiredLog: 'Sign in first to control the robot',
            authLogout: 'Sign out',
            authLogoutLog: 'You have signed out',
            landingBadge: 'Live · Roborubiks',
            landingTitle: 'Control the robot assembling Megaminx in real time',
            landingLead: 'Join the queue, become the active viewer, and turn faces on a real robot from your browser.',
            landingStep1: 'Click «Join queue»',
            landingStep2: 'Wait for your turn',
            landingStep3: 'Control faces or send a notation path',
            landingApiLink: 'API documentation',
            welcomeHtml: '<strong>Getting started:</strong> queue → active viewer → face controls or notation path',
            queueLabel: 'your position in queue',
            queueMessageDefault: 'Connecting…',
            videoLabel: 'Live stream',
            videoPlaceholder: 'Video appears when you become the active viewer',
            simulatorLabel: 'Simulator',
            videoSectionAria: 'Stream and simulator',
            controlPanelAria: 'Control panel',
            quickActions: 'Quick actions',
            motorTest: 'Motor test',
            solve: 'Solve',
            tabControl: 'Control',
            tabApi: 'API',
            pathTitle: 'Path (notation)',
            pathHint: 'Example: <code>U.F.R\'.BL</code>',
            executePath: 'Run path',
            goToInit: 'Scramble back',
            getState: 'State',
            historyTitle: 'History',
            refreshHistory: 'Refresh',
            copyPath: 'Copy',
            historyEmpty: 'No moves yet — rotate faces or run a path',
            logTitle: 'Event log',
            logEmpty: 'Robot commands and responses appear here',
            apiTitle: 'Python API',
            apiText: 'Control the robot from Jupyter or scripts — <code>MegaminxClient</code> class.',
            apiDocs: 'API documentation',
            apiNotebook: 'Jupyter notebook',
            apiClient: 'megaminx_client.py',
            apiColab: 'Open in Google Colab',
            apiTokenTitle: 'API token',
            apiTokenHint: 'Copy your session token for Python or curl requests. Valid while you are signed in. Robot commands still require you to be the active viewer.',
            apiTokenReveal: 'Show',
            apiTokenHide: 'Hide',
            apiTokenCopied: 'Token copied',
            apiTokenNoAuth: 'Auth is disabled — HTTP API works without a token (or use server API_SECRET).',
            apiTokenExamplePy: 'MegaminxClient(api_token="…")',
            configTitle: 'Face configuration',
            configNote: 'Edit <code>faceConfig</code> in <code>viewer-config.js</code> and refresh the page.',
            configCurrent: 'Current configuration:',
            configExample: '// see viewer-config.js',
            copyCode: 'Copy',
            connected: 'Connected',
            waiting: 'Waiting',
            inQueue: 'In queue…',
            joinedQueue: 'Joined queue',
            leftQueue: 'Left queue',
            leaveQueueGoToInit: 'Left queue — robot returning to initial state',
            queueResetting: 'Robot is resetting — please wait',
            robotResettingError: 'Robot is resetting to initial state. Please wait.',
            queueNext: 'Connecting soon — you\'re next!',
            queueBefore: '{n} {people} ahead of you',
            queuePeople1: 'person',
            queuePeople2: 'people',
            queuePeople5: 'people',
            queueFirst: 'You\'re first in queue',
            queuePosition: 'Position {n}',
            connecting: 'Connecting…',
            connectingTitle: 'Connecting to the robot',
            connectingHint: 'Setting up video and controls…',
            waitingQueue: 'Waiting in queue…',
            connectionError: 'Connection error',
            connectionLost: 'Connection lost',
            streamerOffline: 'Streamer offline',
            notActiveViewer: 'Not active viewer',
            notActiveViewerLog: 'You are not the active viewer',
            simNotLoaded: 'Simulator not loaded',
            noSolverApi: 'No solver API in simulator',
            noSolverApiLong: 'Simulator has no solver API (refresh the page)',
            refreshPage: 'Refresh the page',
            solveNotFound: 'Solution not found',
            solveNotFoundLong: 'Solution not found (state may be invalid)',
            alreadySolved: 'already solved',
            solveReceived: 'Solution received',
            reversePathFailed: 'Could not build reverse path',
            noPathToCopy: 'No path to copy',
            pathCopied: 'Path copied: {path}',
            pathCopiedManual: 'Path copied (select manually if needed)',
            copiedBtn: 'Copied!',
            joinQueueFirst: 'Join the queue first',
            confirmGoToInit: 'Scramble the megaminx back?',
            beforeUnload: 'You will lose your queue spot!',
            viewerNotActive: 'Viewer not active',
            simRepainted: 'Simulator synced with robot',
            executingMove: 'Running… move {n}',
            executePathLog: 'execute_path ({n} moves)',
            error: 'Error',
            faceTurnCcw: '{code} counter-clockwise ({code}\')',
            faceTurnCw: '{code} clockwise ({code})',
            executePathDone: 'execute_path: {n} moves',
            timingRobot: 'robot {time}',
            timingLastMove: 'until last move {time}',
            timingSinceSend: 'since send {time}',
            timingTitle: 'execute_path timing',
            timingRobotLabel: 'Robot (motors):',
            timingLastMoveLabel: 'Until last move:',
            timingSinceSendLabel: 'Since command sent:',
            scanOk: 'Simulator synced with robot',
            historyOk: 'Move history: {n}',
            stateOk: 'State: {n} moves executed',
            pathOk: 'Path: {n} moves',
            reversePathOk: 'Reverse path: {path}',
            executePathErr: 'execute_path: {msg} (after {time})',
            secShort: '{n} s',
            minSec: '{m}m {s} s',
            dailyChallengeTitle: 'Daily challenge',
            dailyChallengeHint: 'The same random 500-move scramble for everyone each day. The robot shuffles from solved — submit your solution.',
            dailyChallengeStart: 'Start challenge',
            dailyChallengeRestart: 'Restart challenge',
            dailyChallengeRetryRequired: 'Solution rejected. Click «Restart challenge» (go_to_init → scramble), then submit again.',
            dailyChallengePlaying: 'Daily challenge: robot scrambling…',
            dailyChallengeReset: 'Returning to solved…',
            dailyChallengeScramble: 'Scramble: {path}',
            dailyChallengeReveal: 'Challenge ready — solve: {path}',
            dailyChallengeDate: '{date} · {title} · {n} moves',
            dailyChallengeSolutionLabel: 'Your solution',
            dailyChallengeSubmit: 'Submit solution',
            dailyChallengeCorrect: 'Correct! Solution accepted.',
            dailyChallengeCorrectTime: 'Robot solved in {time}!',
            dailyChallengeWrong: 'Wrong solution. Try again.',
            dailyChallengeNotSolved: 'Megaminx is not solved — check your path',
            dailyChallengeExecuting: 'Running your solution on the robot…',
            dailyChallengeSimSync: 'Syncing simulator…',
            dailyChallengeSimTimeout: 'Simulator did not catch up — wait and try again',
            dailyChallengeVerifying: 'Verifying…',
            dailyChallengeLeaderboard: 'Leaderboard',
            dailyChallengeAlready: 'You already have a better time today.',
            leaderboardTitle: 'Daily challenge leaderboard',
            leaderboardLead: 'Fastest solves for each day\'s scramble. Time is robot motor time only (solution execute_path).',
            leaderboardDate: 'Date',
            leaderboardEmpty: 'No solves for this day yet.',
            leaderboardRank: '#',
            leaderboardUser: 'Player',
            leaderboardTime: 'Robot time',
            leaderboardMoves: 'Moves',
            leaderboardBack: 'Back to controls',
            leaderboardHome: 'Home',
            leaderboardLoading: 'Loading…',
            dailyChallengeAuth: 'Sign in to submit your solution',
            dailyChallengeBusy: 'Challenge already in progress…',
            dailyChallengeDone: 'Today\'s challenge solved!',
            dailyChallengeSolveAgain: 'Solve again',
            dailyChallengeBestTime: 'Best time today: {time}',
            dailyChallengeImproved: 'New record: {time}!',
            dailyChallengeFailed: 'Could not start challenge',
        },
    };

    function detectLang() {
        try {
            const q = new URLSearchParams(global.location.search).get('lang');
            if (q === 'en' || q === 'ru') return q;
        } catch (_) { /* ignore */ }
        try {
            const saved = global.localStorage.getItem('viewerLang');
            if (saved === 'en' || saved === 'ru') return saved;
        } catch (_) { /* ignore */ }
        return (global.navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'ru';
    }

    let lang = detectLang();

    function peopleWord(n) {
        if (lang === 'en') return n === 1 ? STRINGS.en.queuePeople1 : STRINGS.en.queuePeople2;
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return STRINGS.ru.queuePeople1;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return STRINGS.ru.queuePeople2;
        return STRINGS.ru.queuePeople5;
    }

    function t(key, vars = {}) {
        const table = STRINGS[lang] || STRINGS.ru;
        let s = table[key] ?? STRINGS.ru[key] ?? key;
        for (const [k, v] of Object.entries(vars)) {
            s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
        return s;
    }

    function faceName(code) {
        const entry = FACE_NAMES[code];
        if (!entry) return code;
        return entry[lang] || entry.ru || code;
    }

    function isAlreadySolved(text) {
        const s = String(text || '').trim();
        return s === STRINGS.ru.alreadySolved || s === STRINGS.en.alreadySolved;
    }

    function applyTranslations() {
        document.documentElement.lang = lang;
        document.title = t(document.body.classList.contains('index-page') ? 'indexPageTitle' : 'pageTitle');

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-html]').forEach((el) => {
            el.innerHTML = t(el.getAttribute('data-i18n-html'));
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
        });
        document.querySelectorAll('[data-i18n-title]').forEach((el) => {
            el.title = t(el.getAttribute('data-i18n-title'));
        });
        document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
            el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
        });
        document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
            el.alt = t(el.getAttribute('data-i18n-alt'));
        });

        document.querySelectorAll('.lang-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
            btn.setAttribute('aria-pressed', btn.dataset.lang === lang ? 'true' : 'false');
        });
    }

    function setLang(nextLang) {
        if (nextLang !== 'en' && nextLang !== 'ru') return;
        lang = nextLang;
        try {
            global.localStorage.setItem('viewerLang', lang);
        } catch (_) { /* ignore */ }
        applyTranslations();
        global.dispatchEvent(new CustomEvent('viewer:langchange', { detail: { lang } }));
    }

    function viewerHref() {
        return `/viewer.html?lang=${lang}`;
    }

    function initLangSwitcher() {
        const root = document.getElementById('langSwitcher');
        if (!root) return;
        root.querySelectorAll('[data-lang]').forEach((btn) => {
            btn.addEventListener('click', () => setLang(btn.dataset.lang));
        });
    }

    global.viewerI18n = {
        t,
        setLang,
        getLang: () => lang,
        faceName,
        isAlreadySolved,
        applyTranslations,
        initLangSwitcher,
        peopleWord,
        viewerHref,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyTranslations();
            initLangSwitcher();
        });
    } else {
        applyTranslations();
        initLangSwitcher();
    }
})(window);
