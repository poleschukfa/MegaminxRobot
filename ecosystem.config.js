const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const secrets = loadEnv(path.join(__dirname, '.env'));

module.exports = {
  apps: [
    {
      name: 'roborubiks-webrtc',
      script: 'server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: secrets.PORT || 3000,
        CONTROL_PASSWORD: secrets.CONTROL_PASSWORD || '',
        BROADCASTER_SECRET: secrets.BROADCASTER_SECRET || '',
        API_SECRET: secrets.API_SECRET || secrets.CONTROL_PASSWORD || '',
        REGISTRATION_ENABLED: secrets.REGISTRATION_ENABLED || 'true',
        TURN_USER: secrets.TURN_USER || 'roborubiks',
        TURN_PASSWORD: secrets.TURN_PASSWORD || '',
        TURN_URLS: secrets.TURN_URLS || 'turn:roborubiks.ru:3478,turn:130.49.143.78:3478',
      },
    },
  ],
};
