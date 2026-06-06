const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function ensureStore() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(data.users) ? data : { users: [] };
  } catch (_) {
    return { users: [] };
  }
}

function writeStore(store) {
  ensureStore();
  const tmp = `${USERS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, USERS_FILE);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function validateUsername(username) {
  const value = normalizeUsername(username);
  if (value.length < 3 || value.length > 32) {
    return { ok: false, message: 'Логин: от 3 до 32 символов' };
  }
  if (!/^[a-z0-9_]+$/.test(value)) {
    return { ok: false, message: 'Логин: только латиница, цифры и _' };
  }
  return { ok: true, value };
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) {
    return { ok: false, message: 'Пароль: минимум 8 символов' };
  }
  return { ok: true, value };
}

function hasUsers() {
  return readStore().users.length > 0;
}

function findByUsername(username) {
  const normalized = normalizeUsername(username);
  return readStore().users.find((u) => u.username === normalized) || null;
}

function verifyPassword(password, user) {
  if (!user?.salt || !user?.hash) return false;
  const hash = hashPassword(password, user.salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
  } catch (_) {
    return false;
  }
}

function createUser(username, password) {
  const nameCheck = validateUsername(username);
  if (!nameCheck.ok) return nameCheck;
  const passCheck = validatePassword(password);
  if (!passCheck.ok) return passCheck;
  if (findByUsername(nameCheck.value)) {
    return { ok: false, message: 'Пользователь уже существует' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    username: nameCheck.value,
    salt,
    hash: hashPassword(passCheck.value, salt),
    createdAt: new Date().toISOString(),
  };

  const store = readStore();
  store.users.push(user);
  writeStore(store);
  return { ok: true, user: { username: user.username, createdAt: user.createdAt } };
}

module.exports = {
  hasUsers,
  findByUsername,
  verifyPassword,
  createUser,
  validateUsername,
  validatePassword,
  normalizeUsername,
};
