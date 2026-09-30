/* Custorming 에디터: 오브젝트를 화면 틀 안에 배치하고 속성을 바꾼다. */
(function () {
  'use strict';

  const RT = createCustormingRuntime();
  const DEFS = window.CM_COMPONENTS;
  const TEMPLATES = window.CM_TEMPLATES;
  const AUTH = window.CustormingAuth;
  const CLOUD = window.CustormingCloud;
  const uid = window.cmUid;
  const STORAGE_KEY = 'custorming.project.v1';
  const GRID = 8;
  const SNAP_DIST = 6;
  const MIN_SIZE = 16;
  const DEVICES = [
    ['360x740', '기본 폰 (360×740)'],
    ['390x844', 'iPhone (390×844)'],
    ['412x915', '큰 안드로이드 (412×915)'],
    ['768x1024', '태블릿 (768×1024)'],
  ];

  const $ = (sel) => document.querySelector(sel);

  function el(tag, attrs, ...children) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') Object.assign(n.style, v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k in n && typeof v !== 'string') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function toast(msg) {
    document.querySelectorAll('.toast-msg').forEach((old) => old.remove());
    const t = el('div', { class: 'toast-msg', text: msg });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // 창(모달)과 메뉴를 부드럽게 열고 닫는다. 닫힐 때는 사라지는 애니메이션이 끝난 뒤 숨긴다.
  function showLayer(node) {
    node.classList.remove('leaving');
    node.hidden = false;
  }

  function hideLayer(node, done) {
    if (node.hidden) { if (done) done(); return; }
    if (node.classList.contains('leaving')) return;
    node.classList.add('leaving');
    const finish = () => {
      node.removeEventListener('animationend', onEnd);
      if (!node.classList.contains('leaving')) return; // 닫히는 도중에 다시 열렸다
      node.classList.remove('leaving');
      node.hidden = true;
      if (done) done();
    };
    const onEnd = (e) => { if (e.target === node) finish(); };
    node.addEventListener('animationend', onEnd);
    setTimeout(finish, 320); // animationend가 오지 않는 경우를 대비
  }

  function toggleLayer(node) {
    if (node.hidden || node.classList.contains('leaving')) showLayer(node);
    else hideLayer(node);
  }

  const prefersReducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // ---------------------------------------------------------------- 상태

  let project = ensureId(loadStored() || TEMPLATES.tasks.build());
  let screenId = project.startScreen || project.screens[0].id;
  let selectedId = null;
  let clipboard = null;
  let snapOn = true;
  let viewAs = 'guest'; // 캔버스를 게스트/로그인한 사람 중 누구 입장에서 보여줄지
  let zoom = 1;
  const undoStack = [];
  let redoStack = [];
  let lastKey = null;
  let lastTime = 0;

  // ---------------------------------------------------------------- 앱 목록 (이 기기)
  // 게스트와 계정마다 앱 목록을 따로 보관한다.
  //   custorming.apps:<scope>            [{ id, name, updatedAt, remote? }]  (remote = 클라우드에만 있음)
  //   custorming.app:<scope>:<앱 id>      앱 내용
  //   custorming.current-app:<scope>     마지막으로 연 앱

  // (아래 함수들은 상태를 만들기 전에 불리므로 const 화살표 함수가 아닌 함수 선언으로 둔다)
  function scope() { const u = AUTH.current(); return u ? (u.id || u.email) : 'guest'; }
  function indexKey() { return `custorming.apps:${scope()}`; }
  function appKey(id) { return `custorming.app:${scope()}:${id}`; }
  function currentKey() { return `custorming.current-app:${scope()}`; }

  function lsGet(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // 예전 버전은 계정마다 작업 하나만 저장했다. 처음 열 때 목록의 첫 앱으로 옮긴다.
  function migrateLegacy() {
    const oldKey = scope() === 'guest' ? STORAGE_KEY : `${STORAGE_KEY}:${scope()}`;
    const old = lsGet(oldKey, null);
    if (!isProject(old)) return;
    ensureId(old);
    try {
      lsSet(appKey(old.id), old);
      const list = lsGet(indexKey(), []).filter((a) => a.id !== old.id);
      list.push({ id: old.id, name: old.name || '이름 없는 앱', updatedAt: Date.now() });
      lsSet(indexKey(), list);
      if (!lsGet(currentKey(), null)) lsSet(currentKey(), old.id);
      localStorage.removeItem(oldKey);
    } catch (e) { /* 공간이 없으면 다음에 다시 시도 */ }
  }

  function appIndex() {
    migrateLegacy();
    return lsGet(indexKey(), []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function updateIndex(fn) {
    const list = lsGet(indexKey(), []);
    fn(list);
    lsSet(indexKey(), list);
  }

  function readApp(id) {
    const data = lsGet(appKey(id), null);
    return isProject(data) ? data : null;
  }

  function writeApp(p, when) {
    lsSet(appKey(p.id), p);
    updateIndex((list) => {
      const entry = list.find((a) => a.id === p.id);
      const next = { id: p.id, name: p.name || '이름 없는 앱', updatedAt: when || Date.now() };
      if (entry) Object.assign(entry, next, { remote: false });
      else list.push(next);
    });
  }

  function forgetApp(id) {
    localStorage.removeItem(appKey(id));
    updateIndex((list) => { const i = list.findIndex((a) => a.id === id); if (i >= 0) list.splice(i, 1); });
    if (lsGet(currentKey(), null) === id) localStorage.removeItem(currentKey());
    const u = AUTH.current();
    if (u) localStorage.removeItem(`custorming.sync:${u.id}:${id}`);
  }

  // 지금 계정(또는 게스트)에서 마지막으로 연 앱
  function loadStored() {
    const list = appIndex();
    const ids = [lsGet(currentKey(), null)].concat(list.map((a) => a.id));
    for (const id of ids) {
      const data = id && readApp(id);
      if (data) return data;
    }
    return null;
  }

  // 내보낸 앱의 가입 정보를 앱마다 따로 보관하기 위한 고유 id
  function ensureId(data) {
    if (data && !data.id) data.id = uid('p');
    return data;
  }

  function isProject(data) {
    return !!(data && Array.isArray(data.screens) && data.screens.length &&
      data.screens.every((s) => s && s.id && Array.isArray(s.components)));
  }

  let savedAt = null;

  // 이 기기에만 저장 (클라우드에서 받아온 작업을 보관할 때)
  function persistLocal() {
    try {
      writeApp(project);
      lsSet(currentKey(), project.id);
      savedAt = Date.now();
    } catch (e) {
      toast('브라우저 저장 공간이 부족해요. "저장" 버튼으로 파일로 보관하세요.');
    }
    updateSaveStatus();
  }

  // 작업이 바뀔 때마다: 이 기기에 저장하고, 클라우드에 로그인했으면 잠시 뒤 올린다
  function persist() {
    persistLocal();
    scheduleCloudSave();
  }

  function ago(t) {
    const min = Math.floor((Date.now() - t) / 60000);
    return min < 1 ? '방금 전' : min < 60 ? `${min}분 전` : `${Math.floor(min / 60)}시간 전`;
  }

  function updateSaveStatus() {
    const pill = $('#saveStatus');
    if (!pill) return;
    pill.className = 'status-pill';
    pill.title = '';
    const user = AUTH.current();
    if (user && user.cloud) {
      const text = {
        saving: '클라우드에 저장 중…',
        pending: '클라우드에 저장 대기 중',
        saved: '클라우드에 저장됨 · ' + ago(sync.at || Date.now()),
        offline: '오프라인 · 이 기기에만 저장됨',
        error: '클라우드 저장 실패 · 눌러서 다시 시도',
        loading: '클라우드에서 불러오는 중…',
      }[sync.state] || '클라우드 동기화';
      pill.textContent = text;
      if (sync.state === 'offline' || sync.state === 'error') pill.classList.add('warn');
      if (sync.state === 'saved') pill.classList.add('ok');
      pill.title = sync.error || '다른 기기에서 로그인하면 이어서 작업할 수 있어요';
      return;
    }
    if (!savedAt) { pill.textContent = '초안'; return; }
    pill.textContent = '자동 저장됨 · ' + ago(savedAt);
  }

  // ---------------------------------------------------------------- 클라우드 동기화

  // base: 마지막으로 받거나 올린 클라우드 버전, dirty: 아직 못 올린 변경이 있는지
  const sync = { state: 'idle', at: 0, error: '', timer: null, running: false, again: false };

  const syncKey = (id) => `custorming.sync:${(AUTH.current() || {}).id}:${id}`;
  function syncMetaFor(id) {
    return lsGet(syncKey(id), {});
  }
  function setSyncMetaFor(id, patch) {
    try { lsSet(syncKey(id), Object.assign(syncMetaFor(id), patch)); } catch (e) { /* 무시 */ }
  }
  const syncMeta = () => syncMetaFor(project.id);
  const setSyncMeta = (patch) => setSyncMetaFor(project.id, patch);
  const cloudUser = () => { const u = AUTH.current(); return u && u.cloud ? u : null; };

  function setSync(state, error) {
    sync.state = state;
    sync.error = error || '';
    if (state === 'saved') sync.at = Date.now();
    updateSaveStatus();
  }

  function scheduleCloudSave() {
    if (!cloudUser()) return;
    setSyncMeta({ dirty: true });
    clearTimeout(sync.timer);
    setSync('pending');
    sync.timer = setTimeout(() => pushCloud(), 1200);
  }

  async function pushCloud(force) {
    if (!cloudUser()) return;
    clearTimeout(sync.timer);
    if (sync.running) { sync.again = true; return; }
    sync.running = true;
    setSync('saving');
    try {
      const meta = syncMeta();
      const base = force ? undefined : (meta.base || null);
      const updateTime = await CLOUD.save(project, base);
      setSyncMeta({ base: updateTime, dirty: false });
      setSync('saved');
    } catch (err) {
      if (err.conflict) {
        sync.running = false;
        await resolveConflict();
        return;
      }
      setSync(err.offline ? 'offline' : 'error', err.message);
      if (!err.offline) toast(err.message);
    } finally {
      sync.running = false;
    }
    if (sync.again) { sync.again = false; pushCloud(); }
  }

  // 클라우드에서 받은 작업으로 바꾼다 (실행 취소 기록은 비운다)
  function applyRemote(remote, message) {
    loadProject(remote.project, { sync: false });
    setSyncMeta({ base: remote.updateTime, dirty: false });
    setSync('saved');
    if (message) toast(message);
  }

  // 두 기기에서 동시에 고친 경우: 어느 쪽을 남길지 묻는다
  async function resolveConflict() {
    let remote;
    try { remote = await CLOUD.load(project.id); } catch (err) { setSync(err.offline ? 'offline' : 'error', err.message); return; }
    if (!remote) { setSyncMeta({ base: null }); pushCloud(); return; }
    const takeRemote = confirm(
      '다른 기기에서 이 작업이 바뀌었어요.\n\n' +
      `[확인] 다른 기기에서 저장한 작업 불러오기 ("${remote.project.name || '앱'}")\n` +
      '[취소] 이 기기의 작업으로 클라우드를 덮어쓰기');
    if (takeRemote) applyRemote(remote, '다른 기기에서 저장한 작업을 불러왔어요');
    else pushCloud(true);
  }

  // 켤 때 · 로그인할 때 · 창으로 돌아올 때 다른 기기에서 바뀐 내용이 있는지 확인한다
  async function pullCloud(reason) {
    if (!cloudUser() || sync.running) return;
    if (reason !== 'focus') setSync('loading');
    let remote;
    try {
      remote = await CLOUD.load(project.id);
    } catch (err) {
      setSync(err.offline ? 'offline' : 'error', err.message);
      if (err.signedOut) { toast(err.message); loadProject(loadStored() || TEMPLATES.tasks.build(), { sync: false }); }
      else if (!err.offline && reason !== 'focus') toast(err.message);
      return;
    }
    const meta = syncMeta();
    if (!remote) {
      if (meta.base && !meta.dirty && reason !== 'login') {
        // 올린 적이 있는데 없어졌다 = 다른 기기에서 삭제함
        if (confirm(`"${project.name || '앱'}"은(는) 다른 기기에서 삭제됐어요.\n\n[확인] 이 기기에서도 지우기\n[취소] 이 기기의 작업을 다시 올리기`)) {
          forgetApp(project.id);
          openAfterRemoval();
          return;
        }
      }
      // 아직 클라우드에 없음: 지금 작업을 올린다
      setSyncMeta({ base: null });
      pushCloud();
      return;
    }
    if (remote.updateTime === meta.base) {
      if (meta.dirty) pushCloud();
      else setSync('saved');
      return;
    }
    if (meta.dirty && meta.base) {
      await resolveConflict();
      return;
    }
    applyRemote(remote, reason === 'login' ? '클라우드에 저장된 작업을 열었어요' : '다른 기기에서 작업한 내용을 불러왔어요');
  }

  const size = () => RT.sizeOf(project);
  const screen = () => project.screens.find((s) => s.id === screenId) || project.screens[0];
  const selected = () => screen().components.find((c) => c.id === selectedId) || null;

  // 변경 전 상태를 실행 취소 목록에 넣고 fn을 실행한다.
  // 같은 key로 연달아 바뀌는 입력(타이핑 등)은 한 번의 실행 취소로 묶는다.
  function mutate(fn, key) {
    const now = Date.now();
    if (!key || key !== lastKey || now - lastTime > 1500) pushUndo(JSON.stringify(project));
    lastKey = key || null;
    lastTime = now;
    fn();
    persist();
  }

  function pushUndo(snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > 150) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
  }

  function restore(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify(project));
    project = JSON.parse(from.pop());
    lastKey = null;
    if (!project.screens.some((s) => s.id === screenId)) screenId = project.screens[0].id;
    if (!selected()) selectedId = null;
    persist();
    renderAll();
  }

  const undo = () => restore(undoStack, redoStack);
  const redo = () => restore(redoStack, undoStack);

  function updateHistoryButtons() {
    $('#undoBtn').disabled = !undoStack.length;
    $('#redoBtn').disabled = !redoStack.length;
  }

  // ---------------------------------------------------------------- 내 앱 (여러 개 관리)

  // 한 앱을 클라우드에 올린다 (지금 열려 있지 않은 앱에도 쓴다)
  async function uploadApp(p) {
    const meta = syncMetaFor(p.id);
    const updateTime = await CLOUD.save(p, meta.base || null);
    setSyncMetaFor(p.id, { base: updateTime, dirty: false });
  }

  // 클라우드 목록과 이 기기 목록을 맞춘다
  async function refreshCloudList() {
    if (!cloudUser()) return false;
    let remote;
    try {
      remote = await CLOUD.list();
    } catch (err) {
      if (err.signedOut) toast(err.message);
      return false;
    }
    const remoteIds = new Set(remote.map((a) => a.id));
    updateIndex((list) => {
      remote.forEach((r) => {
        const entry = list.find((a) => a.id === r.id);
        const meta = syncMetaFor(r.id);
        if (!entry) list.push({ id: r.id, name: r.name, updatedAt: r.savedAt, remote: true });
        else if (!meta.dirty && meta.base !== r.updateTime) Object.assign(entry, { name: r.name, updatedAt: Math.max(entry.updatedAt || 0, r.savedAt) });
      });
    });
    // 다른 기기에서 지운 앱은 이 기기에서도 지운다 (아직 못 올린 변경이 있으면 남긴다)
    appIndex().forEach((a) => {
      const meta = syncMetaFor(a.id);
      if (!remoteIds.has(a.id) && meta.base && !meta.dirty && a.id !== project.id) forgetApp(a.id);
    });
    // 이 기기에서만 만든 앱은 올려서 다른 기기에서도 보이게 한다
    for (const a of appIndex()) {
      if (a.remote || remoteIds.has(a.id) || a.id === project.id) continue;
      const data = readApp(a.id);
      if (!data) continue;
      try { await uploadApp(data); } catch (e) { break; }
    }
    renderAppsIfOpen();
    return true;
  }

  // 지금 앱의 못 올린 변경을 먼저 올린다 (다른 앱으로 바꾸기 전에)
  async function flushCurrent() {
    clearTimeout(sync.timer);
    if (cloudUser() && syncMeta().dirty) await pushCloud();
  }

  // 이 기기 또는 클라우드에서 앱 내용을 가져온다
  async function appData(id) {
    if (id === project.id) return project;
    const local = readApp(id);
    if (local) return local;
    if (!cloudUser()) throw new Error('앱을 찾을 수 없어요');
    const remote = await CLOUD.load(id);
    if (!remote) throw new Error('다른 기기에서 삭제된 앱이에요');
    writeApp(remote.project, remote.project.updatedAt);
    setSyncMetaFor(id, { base: remote.updateTime, dirty: false });
    return remote.project;
  }

  async function openApp(id) {
    if (id === project.id) { closeApps(); return; }
    await flushCurrent();
    const local = readApp(id);
    if (local) {
      loadProject(local, { sync: false });
      closeApps();
      if (cloudUser()) pullCloud('open');
      return;
    }
    if (!cloudUser()) { toast('앱을 찾을 수 없어요'); return; }
    setSync('loading');
    try {
      const remote = await CLOUD.load(id);
      if (!remote) {
        forgetApp(id);
        renderAppsIfOpen();
        setSync('saved');
        toast('다른 기기에서 삭제된 앱이에요');
        ensureOpenProject();
        return;
      }
      closeApps();
      applyRemote(remote);
    } catch (err) {
      setSync(err.offline ? 'offline' : 'error', err.message);
      toast(err.message);
      ensureOpenProject();
    }
  }

  // 여는 데 실패해서 열린 앱이 없으면 이 기기의 앱이나 새 앱을 연다
  function ensureOpenProject() {
    if (!isProject(project)) loadProject(loadStored() || TEMPLATES.tasks.build(), { sync: false });
  }

  function uniqueAppName(base) {
    const names = new Set(appIndex().map((a) => a.name));
    let name = base;
    let i = 2;
    while (names.has(name)) name = `${base} ${i++}`;
    return name;
  }

  async function newApp(templateKey) {
    await flushCurrent();
    const p = TEMPLATES[templateKey].build();
    p.name = uniqueAppName(p.name);
    loadProject(p);
    closeApps();
    toast(`"${p.name}" 앱을 만들었어요`);
  }

  async function renameApp(id) {
    const entry = appIndex().find((a) => a.id === id);
    const current = id === project.id ? project.name : entry && entry.name;
    const name = (prompt('앱 이름', current || '') || '').trim();
    if (!name || name === current) return;
    if (id === project.id) {
      mutate(() => { project.name = name; });
      renderAll();
      renderAppsIfOpen();
      return;
    }
    try {
      const p = await appData(id);
      p.name = name;
      writeApp(p);
      renderAppsIfOpen();
      if (cloudUser()) await uploadApp(p);
    } catch (err) {
      toast(err.message);
    }
  }

  async function duplicateApp(id) {
    try {
      const copy = clone(await appData(id));
      copy.id = uid('p');
      copy.name = uniqueAppName(`${copy.name || '앱'} 복사본`);
      writeApp(copy);
      renderAppsIfOpen();
      toast(`"${copy.name}"을(를) 만들었어요`);
      if (cloudUser()) await uploadApp(copy);
    } catch (err) {
      toast(err.message);
    }
  }

  async function deleteApp(id) {
    const entry = appIndex().find((a) => a.id === id);
    const name = id === project.id ? project.name : entry && entry.name;
    const where = cloudUser() ? '\n클라우드와 다른 기기에서도 사라져요.' : '';
    if (!confirm(`"${name || '앱'}"을(를) 삭제할까요?${where}\n되돌릴 수 없어요.`)) return;
    if (cloudUser()) {
      try { await CLOUD.remove(id); } catch (err) { toast(err.message); return; }
    }
    const wasCurrent = id === project.id;
    if (wasCurrent) clearTimeout(sync.timer);
    forgetApp(id);
    if (wasCurrent) openAfterRemoval();
    renderAppsIfOpen();
    toast(`"${name || '앱'}"을(를) 삭제했어요`);
  }

  // 지금 앱이 사라졌을 때: 다른 앱을 열고, 하나도 없으면 새로 만든다
  function openAfterRemoval() {
    const next = appIndex()[0];
    if (next) {
      project = { id: '__removed__' }; // openApp이 "이미 열려 있음"으로 착각하지 않게
      openApp(next.id);
      return;
    }
    const p = TEMPLATES.tasks.build();
    loadProject(p);
  }

  function thumbnail(p) {
    const s = RT.findScreen(p, p.startScreen) || p.screens[0];
    const { w, h } = RT.sizeOf(p);
    const scale = 150 / w;
    const box = el('div', { class: 'thumb-stage', style: { width: '150px', height: Math.round(h * scale) + 'px' } });
    const stage = el('div');
    RT.styleStage(stage, p);
    const ctx = RT.staticContext(p, s);
    ctx.viewAs = 'guest';
    stage.appendChild(RT.renderScreen(s, p, ctx));
    Object.assign(stage.style, { position: 'absolute', left: '0', top: '0', transform: `scale(${scale})`, transformOrigin: '0 0' });
    box.appendChild(stage);
    return box;
  }

  function openApps() {
    showLayer($('#appsModal'));
    $('#appsTemplates').hidden = true;
    renderApps();
    if (cloudUser()) {
      $('#appsSync').hidden = false;
      refreshCloudList().finally(() => { $('#appsSync').hidden = true; });
    }
  }

  function closeApps() {
    hideLayer($('#appsModal'));
  }

  function renderAppsIfOpen() {
    if (!$('#appsModal').hidden) renderApps();
  }

  function renderApps() {
    const u = AUTH.current();
    $('#appsWho').textContent = !u
      ? '게스트의 앱이에요. 이 브라우저에 저장되고, 로그인하면 계정에 따로 보관돼요.'
      : u.cloud ? `${u.name}님의 앱 · 클라우드에 동기화돼서 다른 기기에서도 보여요.` : `${u.name}님의 앱 · 이 브라우저에 저장돼요.`;
    const grid = $('#appsGrid');
    grid.innerHTML = '';
    grid.appendChild(el('button', {
      class: 'app-card new',
      onclick: () => { $('#appsTemplates').hidden = !$('#appsTemplates').hidden; },
    }, svgIcon('plus', 28), el('b', { text: '새 앱 만들기' }), el('small', { text: '템플릿에서 시작' })));
    const action = (label, iconName, fn, danger) => el('button', {
      class: 'icon-btn' + (danger ? ' danger' : ''), title: label,
      onclick: (e) => { e.stopPropagation(); fn(); },
    }, svgIcon(iconName, 16));
    appIndex().forEach((a) => {
      const isCurrent = a.id === project.id;
      const data = isCurrent ? project : readApp(a.id);
      const thumb = el('div', { class: 'app-thumb' },
        data ? thumbnail(data) : el('div', { class: 'thumb-cloud' }, svgIcon('cloud', 30), el('span', { text: '클라우드에 있어요' })));
      grid.appendChild(el('div', {
        class: 'app-card' + (isCurrent ? ' current' : ''), title: isCurrent ? '지금 편집 중인 앱' : '눌러서 열기',
        onclick: () => openApp(a.id),
      },
      thumb,
      el('div', { class: 'app-meta' },
        el('b', { text: isCurrent ? (project.name || '이름 없는 앱') : a.name }),
        el('small', { text: isCurrent ? '지금 편집 중' : `${ago(a.updatedAt || Date.now())} 수정` })),
      el('div', { class: 'app-actions' },
        action('이름 바꾸기', 'edit', () => renameApp(a.id)),
        action('복제', 'copy', () => duplicateApp(a.id)),
        action('삭제', 'trash', () => deleteApp(a.id), true))));
    });
  }

  function setupApps() {
    $('#appsBtn').addEventListener('click', openApps);
    $('#appsClose').addEventListener('click', closeApps);
    $('#appsModal').addEventListener('pointerdown', (e) => { if (e.target === $('#appsModal')) closeApps(); });
    const tpl = $('#appsTemplates');
    Object.entries(TEMPLATES).forEach(([k, t]) => tpl.appendChild(el('button', { onclick: () => newApp(k) }, svgIcon('template', 16), t.label)));
  }

  function loadProject(data, opts) {
    undoStack.length = 0;
    redoStack = [];
    project = ensureId(data);
    screenId = project.startScreen || project.screens[0].id;
    selectedId = null;
    if (opts && opts.sync === false) persistLocal();
    else persist();
    renderAll();
  }

  // ---------------------------------------------------------------- 오브젝트 조작

  function snapValue(v) {
    return snapOn ? Math.round(v / GRID) * GRID : Math.round(v);
  }

  function addComponent(type, cx, cy) {
    const def = DEFS[type];
    const { w: W, h: H } = size();
    const w = def.w === 'full' ? W : Math.min(def.w, W);
    const h = Math.min(def.h, H);
    let x;
    let y;
    if (cx == null && def.dock === 'top') { x = 0; y = 0; }
    else if (cx == null && def.dock === 'bottom') { x = 0; y = H - h; }
    else {
      x = def.w === 'full' ? 0 : snapValue((cx == null ? W / 2 : cx) - w / 2);
      y = snapValue((cy == null ? H / 2 : cy) - h / 2);
    }
    const comp = {
      id: uid('c'), type,
      x: clamp(x, 0, W - w), y: clamp(y, 0, H - h), w, h,
      props: clone(def.props),
    };
    mutate(() => screen().components.push(comp));
    selectedId = comp.id;
    renderAll();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function deleteSelected() {
    const comp = selected();
    if (!comp) return;
    mutate(() => {
      const list = screen().components;
      list.splice(list.indexOf(comp), 1);
    });
    selectedId = null;
    renderAll();
  }

  function pasteComponent(source, offset) {
    const { w: W, h: H } = size();
    const copy = clone(source);
    copy.id = uid('c');
    copy.x = clamp(copy.x + offset, 0, Math.max(0, W - copy.w));
    copy.y = clamp(copy.y + offset, 0, Math.max(0, H - copy.h));
    mutate(() => screen().components.push(copy));
    selectedId = copy.id;
    renderAll();
  }

  function reorder(where) {
    const comp = selected();
    if (!comp) return;
    mutate(() => {
      const list = screen().components;
      const i = list.indexOf(comp);
      list.splice(i, 1);
      const to = { front: list.length, back: 0, up: Math.min(list.length, i + 1), down: Math.max(0, i - 1) }[where];
      list.splice(to, 0, comp);
    });
    renderAll();
  }

  function select(id) {
    const changed = id !== selectedId;
    selectedId = id;
    renderSelection();
    renderLayers();
    renderProps();
    // 다른 블록을 고르면 속성 패널이 부드럽게 바뀐다
    if (changed && !prefersReducedMotion()) {
      $('#props').animate([{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
    }
  }

  // ---------------------------------------------------------------- 화면(스크린) 관리

  function addScreen() {
    const name = uniqueScreenName('새 화면');
    const s = { id: uid('s'), name, bg: '', components: [] };
    const header = DEFS.header;
    s.components.push({ id: uid('c'), type: 'header', x: 0, y: 0, w: size().w, h: header.h, props: Object.assign(clone(header.props), { title: name }) });
    mutate(() => project.screens.push(s));
    screenId = s.id;
    selectedId = null;
    renderAll();
  }

  function duplicateScreen(s) {
    const copy = clone(s);
    copy.id = uid('s');
    copy.name = uniqueScreenName(s.name + ' 복사본');
    copy.components.forEach((c) => { c.id = uid('c'); });
    mutate(() => project.screens.splice(project.screens.indexOf(s) + 1, 0, copy));
    screenId = copy.id;
    selectedId = null;
    renderAll();
  }

  function deleteScreen(s) {
    if (project.screens.length < 2) return toast('화면은 최소 하나 있어야 해요');
    if (!confirm(`"${s.name}" 화면을 삭제할까요?`)) return;
    mutate(() => {
      project.screens.splice(project.screens.indexOf(s), 1);
      if (project.startScreen === s.id) project.startScreen = project.screens[0].id;
    });
    screenId = project.screens[0].id;
    selectedId = null;
    renderAll();
  }

  function renameScreen(s, name, key) {
    name = name.trim();
    if (!name) return;
    const old = s.name;
    mutate(() => {
      s.name = name;
      // 탭 바는 화면을 이름으로 가리키므로 함께 바꿔준다
      project.screens.forEach((sc) => sc.components.forEach((c) => {
        if (c.type !== 'tabbar') return;
        c.props.items = String(c.props.items).split('\n').map((line) => {
          const parts = line.split('=');
          return parts.length === 2 && parts[1].trim() === old ? `${parts[0].trimEnd()} = ${name}` : line;
        }).join('\n');
      }));
    }, key);
  }

  function uniqueScreenName(base) {
    let name = base;
    let i = 2;
    while (project.screens.some((s) => s.name === name)) name = `${base} ${i++}`;
    return name;
  }

  // ---------------------------------------------------------------- 아이콘

  const UI_ICONS = {
    puzzle: '<path d="M19.4 14.6a1.55 1.55 0 0 0 2.2-2.2L20 10.8V7a1 1 0 0 0-1-1h-3.8l-1.6-1.6a1.55 1.55 0 0 0-2.2 2.2l.6.4H8a1 1 0 0 0-1 1v3.4l.6-.6a1.55 1.55 0 1 1 2.2 2.2L7 14.8V19a1 1 0 0 0 1 1h4.2l-.6-.6a1.55 1.55 0 0 1 2.2-2.2l2.8 2.8H19a1 1 0 0 0 1-1v-3.8z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    minus: '<path d="M5 12h14"/>',
    magnet: '<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/><path d="m5 8 4 4M12 15l4 4"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
    screen: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>',
    template: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    alignLeft: '<path d="M3 6h18M3 12h12M3 18h16"/>',
    alignCenter: '<path d="M3 6h18M6 12h12M4 18h16"/>',
    alignRight: '<path d="M3 6h18M9 12h12M5 18h16"/>',
    front: '<path d="m17 11-5-5-5 5M17 18l-5-5-5 5"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    back: '<path d="m7 13 5 5 5-5M7 6l5 5 5-5"/>',
    widthFull: '<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    centerH: '<path d="M12 3v18"/><rect x="6" y="8" width="12" height="8" rx="2"/>',
    star: RT.ICONS.star,
    plus: RT.ICONS.plus,
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  };

  // 오브젝트 종류별 아이콘
  const TYPE_ICONS = {
    button: '<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M9 12h6"/>',
    image: RT.ICONS.image,
    text: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
    card: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    header: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/>',
    chat: RT.ICONS.chat,
    chatInput: '<rect x="2" y="7" width="15" height="10" rx="5"/><path d="m22 12-3-2.5v5z"/>',
    checklist: RT.ICONS.list,
    stat: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    avatar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.2 18.4a7 7 0 0 1 11.6 0"/>',
    input: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 10v4"/>',
    toggle: '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="3"/>',
    box: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
    tabbar: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15h18M9 15v6M15 15v6"/>',
    divider: '<path d="M3 12h18"/>',
    authForm: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  };

  function svgIcon(name, size, strokeWidth) {
    const span = document.createElement('span');
    span.style.display = 'inline-flex';
    if (name === 'status') {
      span.innerHTML = '<svg width="48" height="12" viewBox="0 0 48 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2" width="3" height="10" rx="1"/><path d="M22.5 11.5 18 7a6.4 6.4 0 0 1 9 0z"/><rect x="31" y="1.5" width="15" height="9" rx="2.5" fill="none" stroke="currentColor"/><rect x="33" y="3.5" width="10" height="5" rx="1"/></svg>';
      return span;
    }
    const paths = UI_ICONS[name] || TYPE_ICONS[name] || RT.ICONS[name] || '';
    span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size || 18}" height="${size || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth || 2}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    return span;
  }

  function hydrateIcons() {
    document.querySelectorAll('[data-icon]').forEach((node) => {
      const name = node.dataset.icon;
      const sizeByName = { puzzle: 20, rocket: 34, user: 34, cloud: 34, x: 20 };
      node.prepend(svgIcon(name, sizeByName[name] || 18));
    });
  }

  // ---------------------------------------------------------------- 렌더링

  function renderAll() {
    $('#appName').value = project.name || '';
    $('#deviceSelect').value = `${size().w}x${size().h}`;
    renderScreens();
    renderLayers();
    renderCanvas();
    renderProps();
    updateHistoryButtons();
  }

  function renderPalette() {
    const box = $('#palette');
    let group = null;
    Object.entries(DEFS).forEach(([type, def]) => {
      if (def.group !== group) {
        group = def.group;
        box.appendChild(el('div', { class: 'group-label', text: group }));
      }
      const wide = def.group === '레이아웃';
      box.appendChild(el('button', {
        class: wide ? 'wide' : 'tile', draggable: 'true', title: `${def.label} — 끌어다 놓거나 클릭해서 추가`,
        ondragstart: (e) => {
          e.dataTransfer.setData('text/cm-type', type);
          e.dataTransfer.effectAllowed = 'copy';
        },
        onclick: () => addComponent(type),
      },
      svgIcon(type, wide ? 24 : 28, 1.6),
      wide ? el('span', null, el('b', { text: def.label }), el('small', { text: def.desc || '' })) : el('span', { text: def.label })));
    });
  }

  function renderScreens() {
    const list = $('#screenList');
    list.innerHTML = '';
    project.screens.forEach((s) => {
      const isStart = (project.startScreen || project.screens[0].id) === s.id;
      list.appendChild(el('li', {
        class: s.id === screenId ? 'active' : '',
        title: '더블클릭하면 이름 바꾸기',
        onclick: () => {
          if (screenId === s.id) return;
          screenId = s.id;
          selectedId = null;
          renderAll();
        },
        ondblclick: () => {
          const name = prompt('화면 이름', s.name);
          if (name) { renameScreen(s, name); renderAll(); }
        },
      },
      svgIcon('screen', 16),
      el('span', { class: 'name', text: s.name }),
      s.requireLogin ? el('span', { class: 'tag lock', title: '로그인해야 볼 수 있어요' }, svgIcon('authForm', 12, 2.4)) : null,
      isStart ? el('span', { class: 'tag', text: '시작' }) : null));
    });
  }

  function describe(comp) {
    const p = comp.props;
    const text = p.title || p.label || p.text || p.placeholder || (p.items || p.messages || '').split('\n')[0] || '';
    return String(text).slice(0, 24);
  }

  function renderLayers() {
    const list = $('#layerList');
    list.innerHTML = '';
    const comps = screen().components.slice().reverse();
    if (!comps.length) list.appendChild(el('li', { class: 'empty', text: '아직 비어 있어요. 위에서 오브젝트를 추가하세요.' }));
    comps.forEach((c) => {
      const def = DEFS[c.type] || { label: c.type };
      list.appendChild(el('li', {
        class: c.id === selectedId ? 'active' : '',
        onclick: () => {
          if (c.showWhen && c.showWhen !== viewAs) {
            viewAs = c.showWhen;
            document.querySelectorAll('#viewAs button').forEach((x) => x.classList.toggle('on', x.dataset.v === viewAs));
            selectedId = c.id;
            renderCanvas();
          }
          select(c.id);
        },
      },
        svgIcon(c.type, 16),
        el('span', { class: 'name', text: def.label }),
        el('span', { class: 'sub', text: describe(c) }),
        c.showWhen && c.showWhen !== 'always' ? el('span', { class: 'tag', text: c.showWhen === 'guest' ? '게스트' : '로그인' }) : null));
    });
  }

  // 캔버스에 마지막으로 그린 앱·화면 (바뀌었을 때만 전환 애니메이션을 준다)
  let shownOnCanvas = { app: null, screen: null };

  function animateCanvas(node) {
    const before = shownOnCanvas;
    shownOnCanvas = { app: project.id, screen: screenId };
    if (!before.app || typeof node.animate !== 'function' || prefersReducedMotion()) return;
    let frames;
    if (before.app !== project.id) {
      // 다른 앱을 열었을 때: 살짝 커지며 나타난다
      frames = [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }];
    } else if (before.screen !== screenId) {
      // 다른 화면으로: 목록에서 아래 화면이면 오른쪽에서, 위 화면이면 왼쪽에서 들어온다
      const order = project.screens.map((sc) => sc.id);
      const dir = order.indexOf(screenId) >= order.indexOf(before.screen) ? 1 : -1;
      frames = [{ opacity: 0, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: 'none' }];
    } else {
      return;
    }
    node.animate(frames, { duration: 260, easing: 'cubic-bezier(.22,.8,.24,1)' });
  }

  function renderCanvas() {
    const stage = $('#stage');
    stage.innerHTML = '';
    RT.styleStage(stage, project);
    const ctx = RT.staticContext(project, screen());
    ctx.viewAs = viewAs;
    const screenNode = RT.renderScreen(screen(), project, ctx);
    stage.appendChild(screenNode);
    animateCanvas(screenNode);
    const hasConditional = project.screens.some((sc) => sc.components.some((c) => c.showWhen));
    $('#viewAs').hidden = !hasConditional;
    stage.appendChild(el('div', { id: 'guides' }));
    stage.appendChild(el('div', { id: 'selBox', class: 'sel-box', hidden: true }));
    const bg = screen().bg || RT.themeOf(project).bg;
    $('#phoneScreen').style.background = bg;
    $('#phone').style.background = bg;
    $('#dropZone').classList.toggle('empty', !screen().components.length);
    fitCanvas();
    renderSelection();
  }

  const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];
  let zoomMode = 'fit';

  function fitZoom() {
    const { w: W, h: H } = size();
    const area = $('#canvasArea');
    // 휴대폰 테두리(16) + 상태 표시줄(34) + 위아래 여백(72)
    return Math.max(0.2, Math.min(1, (area.clientWidth - 80) / (W + 16), (area.clientHeight - 122) / H));
  }

  function fitCanvas() {
    const { w: W, h: H } = size();
    zoom = zoomMode === 'fit' ? fitZoom() : zoomMode;
    $('#stage').style.transform = `scale(${zoom})`;
    Object.assign($('#phoneScreen').style, { width: W * zoom + 'px', height: H * zoom + 'px' });
    $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
  }

  function setZoom(dir) {
    if (dir === 'fit') zoomMode = 'fit';
    else {
      const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : ZOOM_STEPS.slice().reverse().find((z) => z < zoom - 0.001);
      if (!next) return;
      zoomMode = next;
    }
    fitCanvas();
    renderSelection();
  }

  function renderSelection() {
    const box = $('#selBox');
    if (!box) return;
    const comp = selected();
    if (!comp) { box.hidden = true; return; }
    box.hidden = false;
    Object.assign(box.style, { left: comp.x + 'px', top: comp.y + 'px', width: comp.w + 'px', height: comp.h + 'px' });
    const inv = 1 / zoom;
    box.style.outlineWidth = 2 * inv + 'px';
    box.innerHTML = '';
    const handles = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
    Object.entries(handles).forEach(([dir, [x, y]]) => {
      box.appendChild(el('div', {
        class: 'sel-handle', 'data-handle': dir,
        style: { left: x + '%', top: y + '%', transform: `scale(${inv})`, cursor: dir + '-resize' },
      }));
    });
    box.appendChild(el('div', { class: 'sel-size', text: `${comp.w} × ${comp.h}`, style: { transform: `translate(-50%, ${8 * inv}px) scale(${inv})`, transformOrigin: 'top center' } }));
  }

  function paintComp(comp) {
    const node = $('#stage').querySelector(`.cm-comp[data-id="${comp.id}"]`);
    if (node) Object.assign(node.style, { left: comp.x + 'px', top: comp.y + 'px', width: comp.w + 'px', height: comp.h + 'px' });
    renderSelection();
  }

  function showGuides(xs, ys) {
    const g = $('#guides');
    g.innerHTML = '';
    const t = Math.max(1, 1 / zoom) + 'px';
    xs.forEach((x) => g.appendChild(el('div', { class: 'guide v', style: { left: x + 'px', width: t } })));
    ys.forEach((y) => g.appendChild(el('div', { class: 'guide h', style: { top: y + 'px', height: t } })));
  }

  // ---------------------------------------------------------------- 속성 패널

  const SWATCHES = ['#ffffff', '#f1f5f9', '#0f172a', '#3b82f6', '#8b5cf6', '#10b981', '#f97316'];

  // label 오른쪽에 회색 값(em)을 붙일 수 있는 입력 칸 묶음
  function field(label, control, hint, value) {
    return el('div', { class: 'field' },
      el('div', { class: 'field-label' }, label, value != null ? el('em', { text: value }) : null),
      control,
      hint ? el('div', { class: 'hint', text: hint }) : null);
  }

  function colorControl(value, fallback, onChange) {
    const wrap = el('div', { class: 'swatches' });
    const current = () => (value || '').toLowerCase();
    const paint = () => {
      wrap.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s.dataset.v === current()));
      const custom = wrap.querySelector('.custom');
      const isCustom = !!value && !SWATCHES.includes(current());
      custom.classList.toggle('on', isCustom);
      custom.style.setProperty('--c', value || 'transparent');
      custom.title = isCustom ? `직접 고른 색 ${value}` : '직접 고르기';
    };
    const choose = (v) => { value = v; paint(); onChange(v); };
    wrap.appendChild(el('button', {
      class: 'swatch default', 'data-v': '', title: fallback ? `기본값 (${fallback})` : '없음',
      text: '기본', onclick: () => choose(''),
    }));
    SWATCHES.forEach((c) => wrap.appendChild(el('button', {
      class: 'swatch', 'data-v': c, title: c, style: { background: c }, onclick: () => choose(c),
    })));
    const picker = el('input', { type: 'color', value: toHex(value || fallback) });
    picker.addEventListener('input', () => choose(picker.value));
    wrap.appendChild(el('label', { class: 'swatch custom' }, picker));
    paint();
    return wrap;
  }

  function toHex(color) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = '#000000';
    probe.fillStyle = color || '#000000';
    const v = probe.fillStyle;
    return /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
  }

  function slider(value, min, max, onInput, label) {
    const range = el('input', { type: 'range', min, max, step: 1, value });
    const paint = () => {
      range.style.setProperty('--fill', ((range.value - min) / (max - min)) * 100 + '%');
      if (label) label.textContent = range.value + 'px';
    };
    range.addEventListener('input', () => { paint(); onInput(Number(range.value)); });
    paint();
    return range;
  }

  function segmented(options, value, onPick) {
    const wrap = el('div', { class: 'segmented' });
    options.forEach(([v, label, iconName]) => {
      wrap.appendChild(el('button', {
        class: v === value ? 'on' : '', title: label,
        onclick: () => {
          wrap.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
          wrap.querySelector(`[data-v="${v}"]`).classList.add('on');
          onPick(v);
        },
        'data-v': v,
      }, iconName ? svgIcon(iconName, 18) : label));
    });
    return wrap;
  }

  function switchField(label, checked, onChange, disabled) {
    const box = el('input', { type: 'checkbox', checked: !!checked, disabled: !!disabled });
    box.addEventListener('change', () => onChange(box.checked));
    return el('label', { class: 'switch-field' }, el('span', { text: label }), box, el('span', { class: 'switch' }));
  }

  function imageControl(value, onChange) {
    const text = el('input', { type: 'text', value: value && !value.startsWith('data:') ? value : '', placeholder: value && value.startsWith('data:') ? '업로드한 이미지 사용 중' : 'https://… 이미지 주소' });
    text.addEventListener('input', () => onChange(text.value.trim()));
    const file = el('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      try {
        onChange(await shrinkImage(file.files[0]));
        text.value = '';
        text.placeholder = '업로드한 이미지 사용 중';
      } catch (e) {
        toast('이미지를 읽을 수 없어요');
      }
    });
    return el('div', { class: 'image-row' }, text,
      el('button', { title: '사진 올리기', onclick: () => file.click() }, svgIcon('upload', 16)),
      el('button', { title: '이미지 지우기', onclick: () => { text.value = ''; text.placeholder = 'https://… 이미지 주소'; onChange(''); } }, svgIcon('x', 16)),
      file);
  }

  // 저장 공간을 아끼기 위해 업로드한 이미지를 최대 800px로 줄인다
  function shrinkImage(fileObj) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, 800 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(fileObj.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(fileObj);
    });
  }

  function fieldFor(f, comp) {
    const p = comp.props;
    const theme = RT.themeOf(project);
    const key = comp.id + ':' + f.key;
    const set = (v, rerenderPanel) => {
      mutate(() => { p[f.key] = v; }, key);
      renderCanvas();
      renderLayers();
      if (rerenderPanel) renderProps();
    };

    switch (f.type) {
      case 'textarea': {
        const t = el('textarea', { rows: f.rows || 3 });
        t.value = p[f.key] || '';
        t.addEventListener('input', () => set(t.value));
        return field(f.label, t, f.hint);
      }
      case 'number': {
        const em = el('em');
        return el('div', { class: 'field' },
          el('div', { class: 'field-label' }, f.label, em),
          slider(Number(p[f.key]) || 0, f.min, f.max, (v) => set(v), em));
      }
      case 'checkbox':
        return switchField(f.label, p[f.key], (v) => set(v));
      case 'select': {
        if (f.key === 'align') {
          const icons = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight' };
          return field(f.label, segmented(f.options.map(([v, l]) => [v, l, icons[v]]), p[f.key], (v) => set(v)));
        }
        if (f.options.length <= 3) return field(f.label, segmented(f.options, p[f.key], (v) => set(v)));
        const s = el('select', { onchange: () => set(s.value, true) },
          f.options.map(([v, label]) => el('option', { value: v, text: label })));
        s.value = p[f.key];
        return field(f.label, s, f.hint);
      }
      case 'screen': {
        const s = el('select', { onchange: () => set(s.value, true) },
          el('option', { value: '', text: '(없음)' }),
          project.screens.map((sc) => el('option', { value: sc.id, text: sc.name })));
        const target = RT.findScreen(project, p[f.key]);
        s.value = target ? target.id : '';
        return field(f.label, s, f.hint);
      }
      case 'color': {
        const fallback = { primary: theme.primary, text: theme.text }[f.fallback] || f.fallback;
        const em = el('em', { text: p[f.key] || '기본' });
        return el('div', { class: 'field' },
          el('div', { class: 'field-label' }, f.label, em),
          colorControl(p[f.key], fallback, (v) => { em.textContent = v || '기본'; set(v); }));
      }
      case 'image':
        return field(f.label, imageControl(p[f.key], (v) => set(v)), f.hint);
      default: {
        const i = el('input', { type: 'text', value: p[f.key] == null ? '' : p[f.key] });
        i.addEventListener('input', () => set(i.value));
        return field(f.label, i, f.hint);
      }
    }
  }

  // 속성 칸을 성격별 묶음으로 나눈다
  function sectionOf(f, def) {
    if (['action', 'target', 'url'].includes(f.key) || (f.key === 'message' && def === DEFS.button)) return '동작';
    if (['size', 'fontSize', 'bold', 'align'].includes(f.key)) return '글자';
    if (f.type === 'color' || ['radius', 'shadow', 'borderWidth', 'variant', 'style', 'thickness', 'fit'].includes(f.key)) return '모양';
    return '내용';
  }

  function renderProps() {
    const root = $('#props');
    root.innerHTML = '';
    const comp = selected();
    if (comp) renderComponentProps(root, comp);
    else renderScreenProps(root);
  }

  function renderComponentProps(root, comp) {
    const def = DEFS[comp.type];
    root.appendChild(el('div', { class: 'props-head' }, el('h2', { text: '속성' }), el('span', { text: `${def.label} 블록` })));

    const geo = el('div', { class: 'geo' });
    [['x', 'X'], ['y', 'Y'], ['w', '너비'], ['h', '높이']].forEach(([k, label]) => {
      const input = el('input', { type: 'number', value: comp[k], 'data-geo': k });
      input.addEventListener('input', () => {
        if (input.value === '') return;
        const v = Math.round(Number(input.value));
        mutate(() => { comp[k] = k === 'w' || k === 'h' ? Math.max(MIN_SIZE, v) : v; }, comp.id + ':geo:' + k);
        renderCanvas();
      });
      geo.appendChild(el('label', null, label, input));
    });
    const W = size().w;
    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '위치와 크기' }), geo,
      el('div', { class: 'btn-row' },
        el('button', { onclick: () => { mutate(() => { comp.x = 0; comp.w = W; }); renderAll(); } }, svgIcon('widthFull', 16), '가로 꽉 채우기'),
        el('button', { onclick: () => { mutate(() => { comp.x = Math.round((W - comp.w) / 2); }); renderAll(); } }, svgIcon('centerH', 16), '가운데로'))));

    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '보이는 때' }),
      segmented([['always', '항상'], ['guest', '로그인 전'], ['member', '로그인 후']], comp.showWhen || 'always', (v) => {
        mutate(() => { if (v === 'always') delete comp.showWhen; else comp.showWhen = v; });
        if (v !== 'always') {
          viewAs = v;
          document.querySelectorAll('#viewAs button').forEach((x) => x.classList.toggle('on', x.dataset.v === v));
        }
        renderCanvas();
        renderLayers();
      }),
      el('div', { class: 'hint', text: '미리보기와 내보낸 앱에서, 앱 사용자가 로그인했는지에 따라 이 블록을 보이거나 숨겨요' })));

    const groups = {};
    def.fields.forEach((f) => {
      if (f.show && !f.show(comp.props)) return;
      const name = sectionOf(f, def);
      (groups[name] = groups[name] || []).push(fieldFor(f, comp));
    });
    ['내용', '동작', '모양', '글자'].forEach((name) => {
      if (!groups[name]) return;
      const section = el('div', { class: 'props-section' }, el('h4', { text: name }), groups[name]);
      if (name === '내용' && def.note) section.appendChild(el('div', { class: 'note', text: def.note }));
      root.appendChild(section);
    });

    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '겹치는 순서' }),
      el('div', { class: 'segmented' },
        [['front', '맨 앞으로'], ['up', '앞으로'], ['down', '뒤로'], ['back', '맨 뒤로']].map(([w, label]) =>
          el('button', { title: label, onclick: () => reorder(w) }, svgIcon(w, 16))))));

    root.appendChild(el('div', { class: 'actions' },
      el('button', { class: 'outline', onclick: () => pasteComponent(comp, GRID * 2) }, svgIcon('copy', 16), '블록 복제'),
      el('button', { class: 'outline danger', onclick: deleteSelected }, svgIcon('trash', 16), '블록 삭제')));
  }

  // 앱 사용자 계정을 어디에 저장할지: 이 기기(localStorage) 또는 Firebase(여러 기기)
  function authProviderControls() {
    const conf = project.auth || {};
    const provider = conf.provider === 'firebase' ? 'firebase' : 'local';
    const setAuth = (patch, key) => mutate(() => { project.auth = Object.assign({}, project.auth, patch); }, key);
    const wrap = el('div', { class: 'props-section-inner' });
    wrap.appendChild(field('계정 저장 위치', segmented([['local', '이 기기만'], ['firebase', 'Firebase · 여러 기기']], provider, (v) => {
      setAuth({ provider: v });
      renderProps();
    }), provider === 'local' ? '가입 정보가 앱을 쓰는 사람의 기기에만 저장돼요. 다른 기기에서는 같은 계정으로 로그인할 수 없어요' : null));
    if (provider !== 'firebase') return wrap;

    const keyInput = el('input', { type: 'text', value: conf.apiKey || '', placeholder: 'AIzaSy…', spellcheck: 'false', autocomplete: 'off' });
    const status = el('div', { class: 'fb-status', hidden: true });
    const missing = el('div', { class: 'fb-status bad', text: '키를 넣기 전까지는 "이 기기만" 방식으로 동작해요', hidden: !!conf.apiKey });
    keyInput.addEventListener('input', () => {
      setAuth({ apiKey: keyInput.value.trim() }, 'auth:key');
      status.hidden = true;
      missing.hidden = !!keyInput.value.trim();
    });
    const check = el('button', {
      onclick: async () => {
        check.disabled = true;
        status.hidden = false;
        status.className = 'fb-status';
        status.textContent = '확인하는 중…';
        const r = await RT.checkFirebase(keyInput.value);
        status.className = 'fb-status ' + (r.ok ? 'ok' : 'bad');
        status.textContent = r.message;
        check.disabled = false;
      },
    }, svgIcon('check', 16), '연결 확인');
    wrap.appendChild(field('Firebase 웹 API 키', el('div', { class: 'image-row' }, keyInput, check), '웹 API 키는 앱에 들어가도 되는 공개용 키예요'));
    wrap.appendChild(status);
    wrap.appendChild(missing);
    wrap.appendChild(el('details', { class: 'note fb-guide' },
      el('summary', { text: 'Firebase 연결 방법 (5분)' }),
      el('ol', null,
        el('li', null, el('a', { href: 'https://console.firebase.google.com/', target: '_blank', rel: 'noopener', text: 'Firebase 콘솔' }), '에서 프로젝트를 만들어요 (무료).'),
        el('li', { text: '왼쪽 메뉴 빌드 → Authentication → 시작하기를 눌러요.' }),
        el('li', { text: '로그인 방법 탭에서 "이메일/비밀번호"를 사용 설정해요.' }),
        el('li', { text: '톱니바퀴 → 프로젝트 설정 → 일반 탭에서 "웹 API 키"를 복사해 위에 붙여넣어요. (웹 앱이 없다면 </> 아이콘으로 웹 앱을 먼저 추가하세요)' }),
        el('li', { text: '"연결 확인"을 누르고, 미리보기에서 가입해 보세요. 가입한 사람은 Firebase 콘솔의 Users 탭에 보여요.' }))));
    return wrap;
  }

  function renderScreenProps(root) {
    const s = screen();
    const theme = RT.themeOf(project);
    root.appendChild(el('div', { class: 'props-head' }, el('h2', { text: '속성' }), el('span', { text: `화면 · ${s.name}` })));

    const name = el('input', { type: 'text', value: s.name });
    name.addEventListener('input', () => { renameScreen(s, name.value, s.id + ':name'); renderScreens(); renderCanvas(); });
    const isStart = (project.startScreen || project.screens[0].id) === s.id;

    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '이 화면' }),
      field('이름', name),
      field('배경색', colorControl(s.bg, theme.bg, (v) => { mutate(() => { s.bg = v; }, s.id + ':bg'); renderCanvas(); })),
      switchField('앱을 켜면 처음 보이는 화면', isStart, () => { mutate(() => { project.startScreen = s.id; }); renderAll(); }, isStart),
      switchField('로그인해야 볼 수 있는 화면', s.requireLogin, (v) => {
        mutate(() => { if (v) s.requireLogin = true; else delete s.requireLogin; });
        renderScreens();
        if (v && !RT.loginScreenOf(project)) toast('로그인 폼이 있는 화면을 만들어 주세요. 게스트는 그 화면으로 안내돼요');
      }),
      el('div', { class: 'btn-row' },
        el('button', { onclick: () => duplicateScreen(s) }, svgIcon('copy', 16), '화면 복제'),
        el('button', { onclick: () => deleteScreen(s) }, svgIcon('trash', 16), '화면 삭제'))));

    const setTheme = (k) => (v) => {
      mutate(() => { project.theme = Object.assign({}, project.theme, { [k]: v || RT.DEFAULT_THEME[k] }); }, 'theme:' + k);
      renderCanvas();
    };
    const font = el('select', { onchange: () => setTheme('font')(font.value) },
      [['pretendard', 'Pretendard'], ['system', '시스템 고딕'], ['serif', '명조'], ['mono', '고정폭']].map(([v, l]) => el('option', { value: v, text: l })));
    font.value = theme.font;
    const t = project.theme || {};

    const loginSel = el('select', { onchange: () => { mutate(() => { if (loginSel.value) project.loginScreen = loginSel.value; else delete project.loginScreen; }); } },
      el('option', { value: '', text: '자동 (로그인 폼이 있는 첫 화면)' }),
      project.screens.map((sc) => el('option', { value: sc.id, text: sc.name })));
    loginSel.value = RT.findScreen(project, project.loginScreen) ? RT.findScreen(project, project.loginScreen).id : '';
    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '앱 사용자 로그인' }),
      field('로그인 화면', loginSel, '"로그인해야 볼 수 있는 화면"에 게스트가 들어가거나, 버튼 동작이 "로그인 화면으로"일 때 이 화면을 보여줘요'),
      authProviderControls()));

    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '앱 전체 테마' }),
      field('대표 색', colorControl(t.primary === RT.DEFAULT_THEME.primary ? '' : t.primary, RT.DEFAULT_THEME.primary, setTheme('primary')), '헤더, 버튼, 내 말풍선처럼 색을 "기본"으로 둔 블록에 쓰여요'),
      field('기본 배경색', colorControl(t.bg === RT.DEFAULT_THEME.bg ? '' : t.bg, RT.DEFAULT_THEME.bg, setTheme('bg'))),
      field('기본 글자색', colorControl(t.text === RT.DEFAULT_THEME.text ? '' : t.text, RT.DEFAULT_THEME.text, setTheme('text'))),
      field('글꼴', font),
      field('화면 전환 효과',
        segmented([['slide', '밀어내기'], ['fade', '페이드'], ['zoom', '확대'], ['none', '없음']], theme.transition || 'slide', (v) => setTheme('transition')(v)),
        '미리보기와 내보낸 앱에서 화면이 바뀔 때의 움직임이에요. 탭 전환은 항상 부드럽게 겹쳐져요')));

    root.appendChild(el('div', { class: 'note' },
      '블록을 누르면 여기서 색, 글꼴, 모양을 바꿀 수 있어요. ',
      '빈 곳을 누르면 이 화면과 앱 전체 테마를 바꿔요.'));
  }

  // ---------------------------------------------------------------- 캔버스 마우스/터치 조작

  function stagePoint(e) {
    const r = $('#stage').getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }

  // 다른 오브젝트의 가장자리/가운데, 화면 가장자리/가운데에 맞춘다
  function smartSnap(comp, x, y) {
    const { w: W, h: H } = size();
    const others = screen().components.filter((c) => c !== comp);
    const tx = [0, W / 2, W];
    const ty = [0, H / 2, H];
    others.forEach((c) => { tx.push(c.x, c.x + c.w / 2, c.x + c.w); ty.push(c.y, c.y + c.h / 2, c.y + c.h); });

    function best(pos, len, targets) {
      let hit = null;
      [0, len / 2, len].forEach((off) => targets.forEach((t) => {
        const d = t - (pos + off);
        if (Math.abs(d) <= SNAP_DIST && (!hit || Math.abs(d) < Math.abs(hit.d))) hit = { d, line: t };
      }));
      return hit;
    }

    const bx = snapOn ? best(x, comp.w, tx) : null;
    const by = snapOn ? best(y, comp.h, ty) : null;
    return {
      x: bx ? Math.round(x + bx.d) : snapValue(x),
      y: by ? Math.round(y + by.d) : snapValue(y),
      xs: bx ? [bx.line] : [],
      ys: by ? [by.line] : [],
    };
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const handle = e.target.closest('[data-handle]');
    const node = e.target.closest('.cm-comp');
    let comp;
    if (handle) comp = selected();
    else if (node) {
      comp = screen().components.find((c) => c.id === node.dataset.id);
      if (comp && comp.id !== selectedId) select(comp.id);
    }
    if (!comp) { if (selectedId) select(null); return; }

    e.preventDefault();
    const before = JSON.stringify(project);
    const start = stagePoint(e);
    const orig = { x: comp.x, y: comp.y, w: comp.w, h: comp.h };
    const mode = handle ? handle.dataset.handle : 'move';
    const { w: W, h: H } = size();
    let moved = false;

    function onMove(ev) {
      const pt = stagePoint(ev);
      const dx = pt.x - start.x;
      const dy = pt.y - start.y;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      moved = true;

      if (mode === 'move') {
        const s = smartSnap(comp, orig.x + dx, orig.y + dy);
        comp.x = clamp(s.x, 0, Math.max(0, W - comp.w));
        comp.y = clamp(s.y, 0, Math.max(0, H - comp.h));
        showGuides(s.xs, s.ys);
      } else {
        let L = orig.x;
        let R = orig.x + orig.w;
        let T = orig.y;
        let B = orig.y + orig.h;
        if (mode.includes('e')) R = clamp(snapValue(R + dx), 0, W);
        if (mode.includes('w')) L = clamp(snapValue(L + dx), 0, W);
        if (mode.includes('s')) B = clamp(snapValue(B + dy), 0, H);
        if (mode.includes('n')) T = clamp(snapValue(T + dy), 0, H);
        if (R - L < MIN_SIZE) { if (mode.includes('w')) L = R - MIN_SIZE; else R = L + MIN_SIZE; }
        if (B - T < MIN_SIZE) { if (mode.includes('n')) T = B - MIN_SIZE; else B = T + MIN_SIZE; }
        Object.assign(comp, { x: L, y: T, w: R - L, h: B - T });
      }
      paintComp(comp);
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      showGuides([], []);
      if (!moved) return;
      pushUndo(before);
      lastKey = null;
      persist();
      renderCanvas();
      renderProps();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function setupCanvas() {
    const target = $('#phoneScreen');
    target.addEventListener('pointerdown', onPointerDown);
    const zone = el('div', { id: 'dropZone', class: 'drop-zone' }, svgIcon('plus', 26), el('span', { text: '여기에 오브젝트를 놓으세요' }));
    target.appendChild(zone);
    target.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('text/cm-type')) return;
      e.preventDefault();
      zone.classList.add('active');
    });
    target.addEventListener('dragleave', (e) => { if (!target.contains(e.relatedTarget)) zone.classList.remove('active'); });
    target.addEventListener('drop', (e) => {
      zone.classList.remove('active');
      const type = e.dataTransfer.getData('text/cm-type');
      if (!DEFS[type]) return;
      e.preventDefault();
      const pt = stagePoint(e);
      addComponent(type, pt.x, pt.y);
    });
    $('#canvasArea').addEventListener('pointerdown', (e) => {
      if (e.target === $('#canvasArea') && selectedId) select(null);
    });
    window.addEventListener('resize', () => { fitCanvas(); renderSelection(); });
  }

  // ---------------------------------------------------------------- 키보드

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!$('#authModal').hidden) {
        if (e.key === 'Escape') closeAuth();
        return;
      }
      if (!$('#cloudModal').hidden) {
        if (e.key === 'Escape') closeCloudSettings();
        return;
      }
      if (!$('#appsModal').hidden) {
        if (e.key === 'Escape') closeApps();
        return;
      }
      if (!$('#welcome').hidden) {
        if (e.key === 'Escape' || e.key === 'Enter') closeWelcome();
        return;
      }
      if (!$('#previewModal').hidden) {
        if (e.key === 'Escape') closePreview();
        return;
      }
      if (e.key === 'Escape' && !($('#moreMenu').hidden && $('#accountMenu').hidden)) {
        hideLayer($('#moreMenu'));
        hideLayer($('#accountMenu'));
        return;
      }
      const typing = e.target.closest('input, textarea, select, [contenteditable]');
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && k === 'y' && !typing) { e.preventDefault(); redo(); return; }
      if (mod && k === 's') { e.preventDefault(); saveJson(); return; }
      if (typing) return;

      const comp = selected();
      if (mod && k === 'c' && comp) { clipboard = clone(comp); toast('복사했어요'); return; }
      if (mod && k === 'v' && clipboard) { e.preventDefault(); pasteComponent(clipboard, GRID * 2); return; }
      if (mod && k === 'd' && comp) { e.preventDefault(); pasteComponent(comp, GRID * 2); return; }
      if (e.key === 'Escape') { select(null); return; }
      if (!comp) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
      const step = e.shiftKey ? 10 : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (delta) {
        e.preventDefault();
        mutate(() => { comp.x += delta[0]; comp.y += delta[1]; }, comp.id + ':nudge');
        paintComp(comp);
        renderProps();
      }
    });
  }

  // ---------------------------------------------------------------- 미리보기

  function openPreview() {
    const modal = $('#previewModal');
    showLayer(modal);
    $('#previewTitle').textContent = `${project.name || '앱'} 미리보기 — 실제처럼 눌러보세요`;
    startPreview(screenId);
  }

  function startPreview(fromScreen) {
    const { w: W, h: H } = size();
    const holder = $('.preview-holder');
    const scale = Math.max(0.2, Math.min(1, (holder.clientWidth - 40) / (W + 16), (holder.clientHeight - 90) / H));
    const mount = $('#previewMount');
    const start = RT.findScreen(project, fromScreen) || project.screens[0];
    $('#previewPhone').style.background = start.bg || RT.themeOf(project).bg;
    RT.mount(mount, project, { screenId: fromScreen });
    mount.firstChild.style.transform = `scale(${scale})`;
    Object.assign($('#previewScreen').style, { width: W * scale + 'px', height: H * scale + 'px' });
  }

  function closePreview() {
    hideLayer($('#previewModal'), () => { $('#previewMount').innerHTML = ''; });
  }

  // ---------------------------------------------------------------- 파일 저장/불러오기/내보내기

  function fileBase() {
    return (project.name || 'app').replace(/[\\/:*?"<>|\s]+/g, '_');
  }

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = el('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function saveJson() {
    download(fileBase() + '.custorming.json', JSON.stringify(project, null, 2), 'application/json');
    toast('프로젝트 파일을 저장했어요');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function buildAppHtml() {
    const data = JSON.stringify(project).replace(/</g, '\\u003c');
    const theme = RT.themeOf(project);
    return [
      '<!doctype html>',
      '<html lang="ko">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
      `<meta name="theme-color" content="${escapeHtml(theme.primary)}">`,
      '<meta name="generator" content="Custorming">',
      `<title>${escapeHtml(project.name || '앱')}</title>`,
      '</head>',
      '<body>',
      '<div id="app"></div>',
      `<script type="application/json" id="custorming-project">${data}</script>`,
      '<script>',
      createCustormingRuntime.toString(),
      "createCustormingRuntime().boot(document.getElementById('app'), JSON.parse(document.getElementById('custorming-project').textContent));",
      '</script>',
      '</body>',
      '</html>',
      '',
    ].join('\n');
  }

  function exportHtml() {
    download(fileBase() + '.html', buildAppHtml(), 'text/html');
    toast('HTML 앱을 내보냈어요. 휴대폰이나 브라우저에서 바로 열 수 있어요');
  }

  async function openFile(fileObj) {
    try {
      const text = await fileObj.text();
      let data;
      if (/^\s*</.test(text)) {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const node = doc.getElementById('custorming-project');
        if (!node) throw new Error('Custorming으로 만든 HTML이 아니에요');
        data = JSON.parse(node.textContent);
      } else {
        data = JSON.parse(text);
      }
      if (!isProject(data)) throw new Error('올바른 프로젝트 파일이 아니에요');
      // 지금 작업을 지우지 않고 새 앱으로 추가한다
      await flushCurrent();
      if (!data.id || appIndex().some((a) => a.id === data.id)) data.id = uid('p');
      data.name = uniqueAppName(data.name || '가져온 앱');
      loadProject(data);
      toast(`"${data.name || '앱'}"을(를) 불러왔어요`);
    } catch (err) {
      toast('불러오기 실패: ' + err.message);
    }
  }

  // ---------------------------------------------------------------- 상단 바

  // 템플릿은 지금 작업을 지우지 않고 새 앱으로 만든다
  function startFromTemplate(k) {
    newApp(k);
  }

  function setupMenu() {
    const menu = $('#moreMenu');
    const item = (iconName, label, fn) => el('button', { onclick: () => { hideLayer(menu); fn(); } }, svgIcon(iconName, 16), label);
    menu.append(
      item('apps', '내 앱 목록', openApps),
      el('hr'),
      el('div', { class: 'menu-label', text: '새 앱 만들기' }),
      ...Object.entries(TEMPLATES).map(([k, t]) => item('template', t.label, () => startFromTemplate(k))),
      el('hr'),
      item('folder', '파일 열기 (JSON · 내보낸 HTML)', () => $('#fileInput').click()),
      item('download', '앱 내보내기 (HTML 파일)', exportHtml),
      el('hr'),
      item('cloud', '클라우드 동기화 설정', openCloudSettings),
      el('hr'),
      item('help', '시작 안내 다시 보기', openWelcome));
    $('#moreBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleLayer(menu); });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menu-wrap')) hideLayer(menu); });
  }

  // ---------------------------------------------------------------- 환영 안내

  const WELCOME_KEY = 'custorming.welcomed';

  function openWelcome() {
    showLayer($('#welcome'));
    $('#welcomeGo').focus();
  }

  function closeWelcome() {
    hideLayer($('#welcome'));
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* 저장 못 해도 괜찮음 */ }
  }

  function setupWelcome() {
    $('#welcomeGo').addEventListener('click', closeWelcome);
    $('#welcomeClose').addEventListener('click', closeWelcome);
    $('#welcome').addEventListener('pointerdown', (e) => { if (e.target === $('#welcome')) closeWelcome(); });
    let seen = false;
    try { seen = !!localStorage.getItem(WELCOME_KEY); } catch (e) { seen = false; }
    if (!seen) openWelcome();
  }

  // ---------------------------------------------------------------- 클라우드 동기화 설정

  function openCloudSettings() {
    const conf = AUTH.cloudConfig();
    const fromFile = !!conf && conf.source === 'file';
    $('#cloudApiKey').value = conf ? conf.apiKey : '';
    $('#cloudProjectId').value = conf ? conf.projectId : '';
    $('#cloudApiKey').disabled = fromFile;
    $('#cloudProjectId').disabled = fromFile;
    $('#cloudSave').hidden = fromFile;
    $('#cloudOff').hidden = fromFile || !conf;
    $('#cloudFileNote').hidden = !fromFile;
    $('#cloudStatus').hidden = true;
    showLayer($('#cloudModal'));
  }

  function closeCloudSettings() {
    hideLayer($('#cloudModal'));
  }

  function cloudStatus(ok, message) {
    const box = $('#cloudStatus');
    box.hidden = false;
    box.className = 'fb-status' + (ok === true ? ' ok' : ok === false ? ' bad' : '');
    box.textContent = message;
  }

  async function checkCloud() {
    const apiKey = $('#cloudApiKey').value.trim();
    const projectId = $('#cloudProjectId').value.trim();
    cloudStatus(null, '확인하는 중…');
    const auth = await RT.checkFirebase(apiKey);
    if (!auth.ok) { cloudStatus(false, '로그인(Authentication): ' + auth.message); return false; }
    const store = await CLOUD.checkFirestore(projectId);
    if (!store.ok) { cloudStatus(false, '저장소(Firestore): ' + store.message); return false; }
    cloudStatus(true, '모두 준비됐어요! 로그인과 Firestore 저장을 쓸 수 있어요');
    return true;
  }

  // 설정을 바꾸면 계정 종류가 달라지므로 로그아웃하고 게스트 작업으로 돌아간다
  function applyCloudConfig(conf) {
    AUTH.setCloudConfig(conf);
    setSync('idle');
    loadProject(loadStored() || TEMPLATES.tasks.build(), { sync: false });
  }

  function setupCloudSettings() {
    $('#cloudRules').textContent = CLOUD.RULES;
    $('#copyRules').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(CLOUD.RULES); toast('규칙을 복사했어요'); } catch (e) { toast('복사하지 못했어요. 직접 선택해서 복사해 주세요'); }
    });
    $('#cloudClose').addEventListener('click', closeCloudSettings);
    $('#cloudModal').addEventListener('pointerdown', (e) => { if (e.target === $('#cloudModal')) closeCloudSettings(); });
    $('#cloudCheck').addEventListener('click', checkCloud);
    $('#cloudSave').addEventListener('click', async () => {
      const apiKey = $('#cloudApiKey').value.trim();
      const projectId = $('#cloudProjectId').value.trim();
      if (!apiKey || !projectId) { cloudStatus(false, '웹 API 키와 프로젝트 ID를 모두 넣어 주세요'); return; }
      if (!(await checkCloud()) && !confirm('연결 확인이 통과되지 않았어요. 그래도 저장할까요?')) return;
      applyCloudConfig({ apiKey, projectId });
      closeCloudSettings();
      toast('클라우드 동기화를 켰어요. 로그인하면 여러 기기에서 이어서 작업할 수 있어요');
      openAuth('login');
    });
    $('#cloudOff').addEventListener('click', () => {
      if (!confirm('클라우드 동기화를 끌까요? 클라우드에 저장된 작업은 그대로 남아 있어요.')) return;
      applyCloudConfig(null);
      closeCloudSettings();
      toast('클라우드 동기화를 껐어요');
    });
  }

  // ---------------------------------------------------------------- 계정 (선택 사항)

  let authMode = 'login';

  function openAuth(mode) {
    const cloud = AUTH.isCloud();
    $('#authFineprint').textContent = cloud
      ? '계정과 작업이 클라우드(Firebase)에 저장돼서 다른 기기에서 로그인해도 이어서 작업할 수 있어요.'
      : '계정은 이 브라우저에만 저장돼요. 여러 기기에서 쓰려면 더보기 → 클라우드 동기화 설정을 켜 주세요.';
    setAuthMode(mode || 'login');
    $('#authForm').reset();
    $('#authError').hidden = true;
    showLayer($('#authModal'));
    (authMode === 'signup' ? $('#authName') : $('#authEmail')).focus();
  }

  function closeAuth() {
    hideLayer($('#authModal'));
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === 'signup';
    document.querySelectorAll('.auth-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    document.querySelectorAll('#authForm [data-only="signup"]').forEach((n) => { n.hidden = !signup; });
    $('#authTitle').textContent = signup ? '회원가입' : '로그인';
    $('#authSub').textContent = signup ? '가입하면 지금 만들던 앱이 새 계정에 그대로 저장돼요.' : '로그인하면 작업이 내 계정에 따로 저장돼요.';
    $('#authSubmit').textContent = signup ? '가입하고 계속하기' : '로그인';
    $('#authPassword').autocomplete = signup ? 'new-password' : 'current-password';
    $('#authForgot').hidden = signup || !AUTH.isCloud();
    $('#authError').hidden = true;
  }

  async function submitAuth(e) {
    e.preventDefault();
    const error = $('#authError');
    const button = $('#authSubmit');
    error.hidden = true;
    const email = $('#authEmail').value;
    const password = $('#authPassword').value;
    try {
      if (authMode === 'signup' && password !== $('#authPassword2').value) throw new Error('비밀번호 확인이 일치하지 않아요');
      button.disabled = true;
      if (authMode === 'signup') {
        // 가입 직후에도 지금 작업을 그대로 이어서 새 계정에 저장한다
        const user = await AUTH.signUp({ name: $('#authName').value, email, password });
        persist();
        toast(user.cloud ? `환영해요, ${user.name}님! 지금 작업이 클라우드에 저장돼요` : `환영해요, ${user.name}님! 지금 작업이 계정에 저장됐어요`);
      } else {
        const user = await AUTH.logIn({ email, password });
        const saved = loadStored();
        if (user.cloud) {
          closeAuth();
          toast(`${user.name}님, 로그인했어요`);
          const guestWork = project;
          setSync('loading');
          await refreshCloudList();
          const apps = appIndex();
          if (!apps.length) {
            // 계정이 비어 있으면 지금 작업을 계정의 첫 앱으로 가져간다
            loadProject(guestWork);
          } else {
            project = { id: '__guest__' };
            await openApp((saved && saved.id) || apps[0].id);
            if (!sync.running && sync.state === 'loading') setSync('saved');
          }
          return;
        }
        if (saved) {
          loadProject(saved);
          toast(`${user.name}님, 다시 오셨네요! 계정에 저장된 작업을 열었어요`);
        } else {
          persist();
          toast(`${user.name}님, 로그인했어요. 지금 작업이 계정에 저장됐어요`);
        }
      }
      closeAuth();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  async function logOut() {
    hideLayer($('#accountMenu'));
    // 아직 못 올린 변경이 있으면 먼저 올려 본다 (실패해도 이 기기에는 남아 있다)
    if (cloudUser() && syncMeta().dirty) await pushCloud();
    AUTH.logOut();
    setSync('idle');
    loadProject(loadStored() || TEMPLATES.tasks.build(), { sync: false });
    toast('로그아웃했어요. 게스트로 계속 쓸 수 있어요');
  }

  function renderAccount() {
    const user = AUTH.current();
    $('#loginBtn').hidden = !!user;
    $('#avatarBtn').hidden = !user;
    if (!user) { $('#accountMenu').hidden = true; return; }
    const initial = Array.from(user.name)[0] || '?';
    $('#avatarBtn').textContent = initial;
    $('#avatarBtn').title = `${user.name} (${user.email})`;
    $('#accountAvatar').textContent = initial;
    $('#accountName').textContent = user.name;
    $('#accountEmail').textContent = user.email;
    document.querySelector('.account-note').textContent = user.cloud
      ? '작업이 클라우드에 동기화돼요. 다른 기기에서 로그인해도 이어서 할 수 있어요.'
      : '작업이 이 브라우저의 계정에 저장돼요.';
  }

  function setupAccount() {
    $('#loginBtn').addEventListener('click', () => openAuth('login'));
    $('#avatarBtn').addEventListener('click', () => toggleLayer($('#accountMenu')));
    $('#logoutBtn').addEventListener('click', logOut);
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#accountWrap')) hideLayer($('#accountMenu')); });
    document.querySelectorAll('.auth-tabs button').forEach((b) => b.addEventListener('click', () => setAuthMode(b.dataset.mode)));
    $('#authForm').addEventListener('submit', submitAuth);
    $('#authClose').addEventListener('click', closeAuth);
    $('#authLater').addEventListener('click', closeAuth);
    $('#authForgot').addEventListener('click', async () => {
      const error = $('#authError');
      error.hidden = true;
      try {
        await AUTH.resetPassword($('#authEmail').value);
        toast('비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요');
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
    $('#authModal').addEventListener('pointerdown', (e) => { if (e.target === $('#authModal')) closeAuth(); });
    AUTH.onChange(() => { renderAccount(); updateSaveStatus(); });
    renderAccount();

    $('#saveStatus').addEventListener('click', () => {
      if (cloudUser() && (sync.state === 'error' || sync.state === 'offline')) pushCloud();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pullCloud('focus').then(() => { if (!$('#appsModal').hidden) refreshCloudList(); });
    });
    window.addEventListener('online', () => { if (syncMeta().dirty) pushCloud(); else pullCloud('focus'); });
    window.addEventListener('beforeunload', (e) => {
      if (cloudUser() && (sync.state === 'pending' || sync.state === 'saving')) {
        pushCloud();
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function setupTopbar() {
    setupMenu();
    const device = $('#deviceSelect');
    DEVICES.forEach(([v, label]) => device.appendChild(el('option', { value: v, text: label })));
    device.addEventListener('change', () => {
      const [w, h] = device.value.split('x').map(Number);
      const old = size();
      mutate(() => {
        project.size = { w, h };
        // 가로로 꽉 찬 오브젝트는 새 너비에 맞추고, 아래에 붙은 오브젝트는 아래에 붙여둔다
        project.screens.forEach((s) => s.components.forEach((c) => {
          if (c.x === 0 && c.w === old.w) c.w = w;
          if (c.y + c.h === old.h) c.y = h - c.h;
          else if (c.h === old.h - c.y) c.h = h - c.y;
        }));
      });
      renderAll();
    });

    const name = $('#appName');
    name.addEventListener('input', () => mutate(() => { project.name = name.value; }, 'app-name'));

    $('#undoBtn').addEventListener('click', undo);
    $('#redoBtn').addEventListener('click', redo);
    $('#snapToggle').addEventListener('change', (e) => { snapOn = e.target.checked; });
    $('#previewBtn').addEventListener('click', openPreview);
    $('#previewClose').addEventListener('click', closePreview);
    $('#previewRestart').addEventListener('click', () => startPreview(project.startScreen));
    $('#saveBtn').addEventListener('click', saveJson);
    document.querySelectorAll('#viewAs button').forEach((b) => b.addEventListener('click', () => {
      viewAs = b.dataset.v;
      document.querySelectorAll('#viewAs button').forEach((x) => x.classList.toggle('on', x === b));
      if (selected() && selected().showWhen && selected().showWhen !== (viewAs === 'guest' ? 'guest' : 'member')) selectedId = null;
      renderCanvas();
      renderProps();
    }));
    $('#zoomIn').addEventListener('click', () => setZoom(1));
    $('#zoomOut').addEventListener('click', () => setZoom(-1));
    $('#zoomLabel').addEventListener('click', () => setZoom('fit'));
    $('#fileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) openFile(e.target.files[0]);
      e.target.value = '';
    });
    $('#addScreenBtn').addEventListener('click', addScreen);
  }

  // ---------------------------------------------------------------- 시작

  RT.injectCSS();
  hydrateIcons();
  renderPalette();
  setupTopbar();
  setupCanvas();
  setupKeyboard();
  setupWelcome();
  setupAccount();
  renderAll();
  updateSaveStatus();
  setupCloudSettings();
  // 처음 켰을 때 지금 앱이 목록에 들어가 있게 한다
  if (!readApp(project.id)) {
    try { writeApp(project); lsSet(currentKey(), project.id); } catch (e) { /* 공간 부족 */ }
  }
  setupApps();
  if (cloudUser()) pullCloud('start').then(() => refreshCloudList());
  setInterval(updateSaveStatus, 30000);

  // 테스트와 콘솔에서 쓰기 위한 창구
  window.custorming = {
    get project() { return project; },
    apps: () => appIndex(),
    openAuth,
    buildAppHtml,
    loadProject,
  };
})();
