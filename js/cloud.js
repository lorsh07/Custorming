/*
 * Custorming 클라우드 저장소 (Firestore REST API)
 * 로그인한 사람의 작업을 users/{uid}/projects/current 문서 하나에 저장한다.
 *
 * 필요한 Firestore 보안 규칙 (본인 데이터만 읽고 쓰기):
 *   match /users/{uid}/{document=**} {
 *     allow read, write: if request.auth != null && request.auth.uid == uid;
 *   }
 */
window.CustormingCloud = (function () {
  'use strict';

  const AUTH = window.CustormingAuth;
  const MAX_BYTES = 900 * 1024; // Firestore 문서 한도(1MiB)보다 조금 작게

  const RULES = [
    "rules_version = '2';",
    'service cloud.firestore {',
    '  match /databases/{database}/documents {',
    '    match /users/{uid}/{document=**} {',
    '      allow read, write: if request.auth != null && request.auth.uid == uid;',
    '    }',
    '  }',
    '}',
  ].join('\n');

  function base(projectId) {
    return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/databases/(default)/documents';
  }

  function docUrl() {
    const conf = AUTH.cloudConfig();
    const user = AUTH.current();
    if (!conf || !user || !user.uid) throw new Error('클라우드에 로그인되어 있지 않아요');
    return base(conf.projectId) + '/users/' + encodeURIComponent(user.uid) + '/projects/current';
  }

  function explain(status, message) {
    const m = String(message || '');
    if (/database .*does not exist|NOT_FOUND.*database/i.test(m)) return 'Firestore 데이터베이스가 아직 없어요. Firebase 콘솔에서 Firestore Database를 만들어 주세요';
    if (/has not been used|is disabled|SERVICE_DISABLED/i.test(m)) return 'Firestore를 아직 켜지 않았어요. Firebase 콘솔에서 Firestore Database를 만들어 주세요';
    if (status === 403) return 'Firestore 보안 규칙 때문에 저장할 수 없어요. 안내된 규칙을 넣어 주세요';
    if (status === 401) return '로그인이 만료됐어요. 다시 로그인해 주세요';
    return '클라우드 저장 중 문제가 생겼어요 (' + (m || status) + ')';
  }

  async function request(method, url, body, token) {
    let res;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      const err = new Error('인터넷에 연결되어 있지 않아요');
      err.offline = true;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { status: res.status, data };
    const message = data.error && data.error.message;
    const status = data.error && data.error.status;
    const err = new Error(explain(res.status, message));
    err.status = res.status;
    err.code = status;
    // 문서가 없을 때(그냥 아직 저장한 적 없음)와 데이터베이스가 없을 때를 구분한다
    err.missingDoc = res.status === 404 && !/database/i.test(message || '');
    // 다른 기기가 먼저 저장해서 버전이 달라진 경우
    err.conflict = status === 'FAILED_PRECONDITION' || (res.status === 409) || (res.status === 400 && /precondition/i.test(message || ''));
    throw err;
  }

  // 클라우드에 저장된 작업 { project, updateTime } 또는 없으면 null
  async function load() {
    const token = await AUTH.getIdToken();
    try {
      const { data } = await request('GET', docUrl(), null, token);
      const json = data.fields && data.fields.data && data.fields.data.stringValue;
      return json ? { project: JSON.parse(json), updateTime: data.updateTime } : null;
    } catch (err) {
      if (err.missingDoc) return null;
      throw err;
    }
  }

  // baseUpdateTime: 마지막으로 받은/올린 버전. 그 사이 다른 기기가 바꿨으면 conflict 오류가 난다.
  // null 이면 "아직 문서가 없어야 함", undefined 이면 확인 없이 덮어쓴다.
  async function save(project, baseUpdateTime) {
    const json = JSON.stringify(project);
    if (new Blob([json]).size > MAX_BYTES) {
      throw new Error('작업이 너무 커서 클라우드에 저장할 수 없어요. 올린 이미지 크기를 줄여 주세요');
    }
    const token = await AUTH.getIdToken();
    let url = docUrl();
    if (baseUpdateTime === null) url += '?currentDocument.exists=false';
    else if (baseUpdateTime) url += '?currentDocument.updateTime=' + encodeURIComponent(baseUpdateTime);
    const body = {
      fields: {
        data: { stringValue: json },
        name: { stringValue: String(project.name || '') },
        savedAt: { timestampValue: new Date().toISOString() },
      },
    };
    const { data } = await request('PATCH', url, body, token);
    return data.updateTime;
  }

  // 설정 창의 "연결 확인": 로그인 없이 문서를 읽어서 돌아온 응답으로 상태를 판단한다
  async function checkFirestore(projectId) {
    if (!String(projectId || '').trim()) return { ok: false, message: '프로젝트 ID를 입력해 주세요' };
    try {
      await request('GET', base(projectId.trim()) + '/users/connection-check/projects/current');
      return { ok: false, message: '보안 규칙이 너무 열려 있어요. 아래 규칙으로 바꿔 주세요' };
    } catch (err) {
      if (err.offline) return { ok: false, message: err.message };
      if (err.status === 403 && !/has not been used|disabled/i.test(err.message)) return { ok: true, message: 'Firestore에 연결됐고 보안 규칙도 잘 적용돼 있어요' };
      if (err.missingDoc) return { ok: false, message: '보안 규칙이 너무 열려 있어요. 아래 규칙으로 바꿔 주세요' };
      if (err.status === 404 && /project/i.test(err.message)) return { ok: false, message: '프로젝트 ID를 찾을 수 없어요' };
      return { ok: false, message: err.message };
    }
  }

  return { load, save, checkFirestore, RULES };
})();
