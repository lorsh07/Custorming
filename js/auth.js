/*
 * Custorming 계정 (선택 사항)
 * 로그인하지 않아도 게스트로 모든 기능을 쓸 수 있고, 원할 때 회원가입/로그인하면
 * 작업이 그 계정에 따로 저장된다.
 *
 * 두 가지 방식이 있다.
 * - 이 브라우저만: 클라우드 설정이 없을 때. 계정을 localStorage에 보관한다.
 * - Firebase: js/config.js 또는 "클라우드 동기화 설정"에 Firebase 값이 있을 때.
 *   Firebase Authentication 계정을 쓰고, 작업은 cloud.js가 Firestore에 동기화한다.
 */
window.CustormingAuth = (function () {
  'use strict';

  const USERS_KEY = 'custorming.users';
  const SESSION_KEY = 'custorming.session';
  const CLOUD_CONFIG_KEY = 'custorming.cloud-config';
  const CLOUD_SESSION_KEY = 'custorming.cloud-session';
  const RT = createCustormingRuntime();
  const listeners = [];

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }

  function emit() {
    const user = current();
    listeners.forEach((fn) => fn(user));
  }

  // ---------------------------------------------------------------- 클라우드 설정

  // js/config.js에 적힌 값이 기기별 설정보다 우선한다
  function cloudConfig() {
    const file = window.CUSTORMING_FIREBASE || {};
    if (String(file.apiKey || '').trim() && String(file.projectId || '').trim()) {
      return { apiKey: file.apiKey.trim(), projectId: file.projectId.trim(), source: 'file' };
    }
    const saved = read(CLOUD_CONFIG_KEY, null);
    if (saved && saved.apiKey && saved.projectId) return { apiKey: saved.apiKey, projectId: saved.projectId, source: 'device' };
    return null;
  }

  function setCloudConfig(conf) {
    write(SESSION_KEY, null);
    write(CLOUD_SESSION_KEY, null);
    write(CLOUD_CONFIG_KEY, conf && conf.apiKey && conf.projectId ? { apiKey: conf.apiKey.trim(), projectId: conf.projectId.trim() } : null);
    cachedToken = null;
    emit();
  }

  const isCloud = () => !!cloudConfig();

  // ---------------------------------------------------------------- 이 브라우저만

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // 비밀번호는 그대로 저장하지 않고 PBKDF2로 해시한다
  async function hashPassword(password, saltHex) {
    if (!window.crypto || !crypto.subtle) throw new Error('이 브라우저에서는 계정 기능을 쓸 수 없어요');
    const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
    return toHex(bits);
  }

  function validateSignUp(name, email, password) {
    if (!name) throw new Error('이름을 입력해 주세요');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('올바른 이메일 주소를 입력해 주세요');
    if (String(password || '').length < 8) throw new Error('비밀번호는 8자 이상이어야 해요');
  }

  const local = {
    current() {
      const email = read(SESSION_KEY, null);
      const u = email && read(USERS_KEY, {})[email];
      return u ? { id: u.email, name: u.name, email: u.email, cloud: false } : null;
    },
    async signUp({ name, email, password }) {
      name = String(name || '').trim();
      email = normalizeEmail(email);
      validateSignUp(name, email, password);
      const users = read(USERS_KEY, {});
      if (users[email]) throw new Error('이미 가입된 이메일이에요. 로그인해 주세요');
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      users[email] = { name, email, salt, hash: await hashPassword(password, salt), createdAt: Date.now() };
      write(USERS_KEY, users);
      write(SESSION_KEY, email);
    },
    async logIn({ email, password }) {
      email = normalizeEmail(email);
      const user = read(USERS_KEY, {})[email];
      if (!user || (await hashPassword(String(password || ''), user.salt)) !== user.hash) {
        throw new Error('이메일 또는 비밀번호가 맞지 않아요');
      }
      write(SESSION_KEY, email);
    },
    logOut() {
      write(SESSION_KEY, null);
    },
  };

  // ---------------------------------------------------------------- Firebase

  let cachedToken = null; // { token, exp }

  const api = () => RT.firebaseClient(cloudConfig().apiKey);

  const cloud = {
    current() {
      const s = read(CLOUD_SESSION_KEY, null);
      return s ? { id: 'fb:' + s.uid, uid: s.uid, name: s.name, email: s.email, cloud: true } : null;
    },
    async signUp({ name, email, password }) {
      name = String(name || '').trim();
      email = normalizeEmail(email);
      validateSignUp(name, email, password);
      const data = await api().accounts('signUp', { email, password, returnSecureToken: true });
      const updated = await api().accounts('update', { idToken: data.idToken, displayName: name, returnSecureToken: true });
      remember(data.localId, data.email, name, updated.refreshToken || data.refreshToken, updated.idToken || data.idToken, updated.expiresIn || data.expiresIn);
    },
    async logIn({ email, password }) {
      const data = await api().accounts('signInWithPassword', { email: normalizeEmail(email), password, returnSecureToken: true });
      remember(data.localId, data.email, data.displayName || data.email.split('@')[0], data.refreshToken, data.idToken, data.expiresIn);
    },
    logOut() {
      write(CLOUD_SESSION_KEY, null);
      cachedToken = null;
    },
  };

  function remember(uid, email, name, refreshToken, idToken, expiresIn) {
    write(CLOUD_SESSION_KEY, { uid, email, name, refreshToken });
    cachedToken = { token: idToken, exp: Date.now() + (Number(expiresIn) || 3600) * 1000 };
  }

  // Firestore 요청에 쓸 ID 토큰 (1시간짜리라 만료가 가까우면 새로 받는다)
  async function getIdToken() {
    const s = read(CLOUD_SESSION_KEY, null);
    if (!s) throw new Error('로그인이 필요해요');
    if (cachedToken && cachedToken.exp - 60000 > Date.now()) return cachedToken.token;
    try {
      const data = await api().refresh(s.refreshToken);
      cachedToken = { token: data.id_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
      if (data.refresh_token && data.refresh_token !== s.refreshToken) write(CLOUD_SESSION_KEY, Object.assign({}, s, { refreshToken: data.refresh_token }));
      return cachedToken.token;
    } catch (err) {
      if (!err.offline) {
        // 계정이 삭제됐거나 비밀번호가 바뀌어 로그인이 끊긴 경우
        cloud.logOut();
        emit();
        err.signedOut = true;
        err.message = '로그인이 만료됐어요. 다시 로그인해 주세요';
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------- 공개 함수

  const provider = () => (isCloud() ? cloud : local);

  function current() {
    return provider().current();
  }

  async function signUp(o) {
    await provider().signUp(o);
    emit();
    return current();
  }

  async function logIn(o) {
    await provider().logIn(o);
    emit();
    return current();
  }

  function logOut() {
    provider().logOut();
    emit();
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  async function resetPassword(email) {
    if (!isCloud()) throw new Error('이 브라우저 계정은 비밀번호 찾기를 지원하지 않아요');
    email = normalizeEmail(email);
    if (!email) throw new Error('이메일을 먼저 입력해 주세요');
    await api().accounts('sendOobCode', { requestType: 'PASSWORD_RESET', email });
  }

  return { current, signUp, logIn, logOut, onChange, resetPassword, isCloud, cloudConfig, setCloudConfig, getIdToken };
})();
