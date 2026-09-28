/*
 * Custorming 계정 (선택 사항)
 * 로그인하지 않아도 게스트로 모든 기능을 쓸 수 있고, 원할 때 회원가입/로그인하면
 * 작업이 그 계정에 따로 저장된다.
 *
 * 지금은 서버 없이 이 브라우저의 localStorage에 계정을 보관한다.
 * 그래서 다른 기기와는 공유되지 않는다. 나중에 서버(Firebase, Supabase 등)를 붙일 때는
 * 아래 signUp / logIn / logOut / current 네 함수만 같은 모양으로 바꾸면 된다.
 */
window.CustormingAuth = (function () {
  'use strict';

  const USERS_KEY = 'custorming.users';
  const SESSION_KEY = 'custorming.session';
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

  function publicUser(u) {
    return u ? { name: u.name, email: u.email, createdAt: u.createdAt } : null;
  }

  function current() {
    const email = read(SESSION_KEY, null);
    const users = read(USERS_KEY, {});
    return publicUser(email && users[email]);
  }

  function emit() {
    const user = current();
    listeners.forEach((fn) => fn(user));
  }

  async function signUp({ name, email, password }) {
    name = String(name || '').trim();
    email = normalizeEmail(email);
    if (!name) throw new Error('이름을 입력해 주세요');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('올바른 이메일 주소를 입력해 주세요');
    if (String(password || '').length < 8) throw new Error('비밀번호는 8자 이상이어야 해요');
    const users = read(USERS_KEY, {});
    if (users[email]) throw new Error('이미 가입된 이메일이에요. 로그인해 주세요');
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    users[email] = { name, email, salt, hash: await hashPassword(password, salt), createdAt: Date.now() };
    write(USERS_KEY, users);
    write(SESSION_KEY, email);
    emit();
    return current();
  }

  async function logIn({ email, password }) {
    email = normalizeEmail(email);
    const user = read(USERS_KEY, {})[email];
    if (!user || (await hashPassword(String(password || ''), user.salt)) !== user.hash) {
      throw new Error('이메일 또는 비밀번호가 맞지 않아요');
    }
    write(SESSION_KEY, email);
    emit();
    return current();
  }

  function logOut() {
    write(SESSION_KEY, null);
    emit();
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  return { current, signUp, logIn, logOut, onChange };
})();
