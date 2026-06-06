function buildIceServers() {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const password = process.env.TURN_PASSWORD || '';
  if (!password) return iceServers;

  const username = process.env.TURN_USER || 'roborubiks';
  const urls = (process.env.TURN_URLS || 'turn:roborubiks.ru:3478')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  for (const turnUrl of urls) {
    iceServers.push({ urls: turnUrl, username, credential: password });
  }
  return iceServers;
}

module.exports = { buildIceServers };
