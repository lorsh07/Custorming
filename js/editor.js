/* Custorming 에디터: 오브젝트를 화면 틀 안에 배치하고 속성을 바꾼다. */
(function () {
  'use strict';

  const RT = createCustormingRuntime();
  const DEFS = window.CM_COMPONENTS;
  const TEMPLATES = window.CM_TEMPLATES;
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

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // ---------------------------------------------------------------- 상태

  let project = loadStored() || TEMPLATES.chat.build();
  let screenId = project.startScreen || project.screens[0].id;
  let selectedId = null;
  let clipboard = null;
  let snapOn = true;
  let zoom = 1;
  const undoStack = [];
  let redoStack = [];
  let lastKey = null;
  let lastTime = 0;

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw && JSON.parse(raw);
      return isProject(data) ? data : null;
    } catch (e) {
      return null;
    }
  }

  function isProject(data) {
    return !!(data && Array.isArray(data.screens) && data.screens.length &&
      data.screens.every((s) => s && s.id && Array.isArray(s.components)));
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (e) {
      toast('브라우저 저장 공간이 부족해요. "저장" 버튼으로 파일로 보관하세요.');
    }
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

  function loadProject(data) {
    undoStack.length = 0;
    redoStack = [];
    project = data;
    screenId = project.startScreen || project.screens[0].id;
    selectedId = null;
    persist();
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
    selectedId = id;
    renderSelection();
    renderLayers();
    renderProps();
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
        box.appendChild(el('div', { class: 'palette-group', text: group }));
      }
      box.appendChild(el('button', {
        class: 'palette-item', draggable: 'true', title: `${def.label} — 클릭하면 화면에 추가`,
        ondragstart: (e) => {
          e.dataTransfer.setData('text/cm-type', type);
          e.dataTransfer.effectAllowed = 'copy';
        },
        onclick: () => addComponent(type),
      }, el('span', { class: 'ico', text: def.icon }), def.label));
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
      el('span', { class: 'ico', text: '▯' }),
      el('span', { class: 'name', text: s.name }),
      isStart ? el('span', { class: 'tag', text: '★ 시작' }) : null));
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
    if (!comps.length) list.appendChild(el('li', { class: 'empty', text: '비어 있어요. 왼쪽 위 오브젝트를 추가하세요.' }));
    comps.forEach((c) => {
      const def = DEFS[c.type] || { icon: '?', label: c.type };
      list.appendChild(el('li', { class: c.id === selectedId ? 'active' : '', onclick: () => select(c.id) },
        el('span', { class: 'ico', text: def.icon }),
        el('span', { class: 'name', text: def.label }),
        el('span', { class: 'sub', text: describe(c) })));
    });
  }

  function renderCanvas() {
    const stage = $('#stage');
    const { w: W, h: H } = size();
    stage.innerHTML = '';
    RT.styleStage(stage, project);
    stage.appendChild(RT.renderScreen(screen(), project, RT.staticContext(project, screen())));
    stage.appendChild(el('div', { id: 'guides' }));
    stage.appendChild(el('div', { id: 'selBox', class: 'sel-box', hidden: true }));
    $('#phoneScreen').style.background = screen().bg || RT.themeOf(project).bg;
    fitCanvas(W, H);
    renderSelection();
  }

  function fitCanvas(W, H) {
    const area = $('#canvasArea');
    const avail = { w: area.clientWidth - 60, h: area.clientHeight - 70 };
    zoom = Math.max(0.2, Math.min(1, avail.w / (W + 20), avail.h / (H + 20)));
    $('#stage').style.transform = `scale(${zoom})`;
    Object.assign($('#phoneScreen').style, { width: W * zoom + 'px', height: H * zoom + 'px' });
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

  function field(label, control, hint) {
    return el('label', { class: 'field' }, el('span', { text: label }), control, hint ? el('div', { class: 'hint', text: hint }) : null);
  }

  function colorControl(value, fallback, onChange) {
    const picker = el('input', { type: 'color', value: toHex(value || fallback) });
    const text = el('input', { type: 'text', value: value || '', placeholder: fallback ? `테마 색 (${fallback})` : '없음' });
    picker.addEventListener('input', () => { text.value = picker.value; onChange(picker.value); });
    text.addEventListener('input', () => { picker.value = toHex(text.value || fallback); onChange(text.value.trim()); });
    const reset = el('button', {
      title: '기본값(테마 색)으로', text: '↺',
      onclick: (e) => { e.preventDefault(); text.value = ''; picker.value = toHex(fallback); onChange(''); },
    });
    return el('div', { class: 'color-row' }, picker, text, reset);
  }

  function toHex(color) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = '#000000';
    probe.fillStyle = color || '#000000';
    const v = probe.fillStyle;
    return /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
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
      el('button', { text: '업로드', onclick: (e) => { e.preventDefault(); file.click(); } }),
      el('button', { text: '✕', title: '이미지 지우기', onclick: (e) => { e.preventDefault(); text.value = ''; text.placeholder = 'https://… 이미지 주소'; onChange(''); } }),
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

  function propControl(f, comp) {
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
        return t;
      }
      case 'number': {
        const n = el('input', { type: 'number', value: p[f.key], min: f.min, max: f.max });
        n.addEventListener('input', () => { if (n.value !== '') set(Number(n.value)); });
        return n;
      }
      case 'checkbox':
        return null; // checkbox는 fieldFor에서 따로 그린다
      case 'select': {
        const s = el('select', { onchange: () => set(s.value, true) },
          f.options.map(([v, label]) => el('option', { value: v, text: label })));
        s.value = p[f.key];
        return s;
      }
      case 'screen': {
        const s = el('select', { onchange: () => set(s.value, true) },
          el('option', { value: '', text: '(없음)' }),
          project.screens.map((sc) => el('option', { value: sc.id, text: sc.name })));
        s.value = RT.findScreen(project, p[f.key]) ? RT.findScreen(project, p[f.key]).id : '';
        return s;
      }
      case 'color': {
        const fallback = { primary: theme.primary, text: theme.text }[f.fallback] || f.fallback;
        return colorControl(p[f.key], fallback, (v) => set(v));
      }
      case 'image':
        return imageControl(p[f.key], (v) => set(v));
      default: {
        const i = el('input', { type: 'text', value: p[f.key] == null ? '' : p[f.key] });
        i.addEventListener('input', () => set(i.value));
        return i;
      }
    }
  }

  function fieldFor(f, comp) {
    if (f.type === 'checkbox') {
      const box = el('input', { type: 'checkbox', checked: !!comp.props[f.key] });
      box.addEventListener('change', () => {
        mutate(() => { comp.props[f.key] = box.checked; });
        renderCanvas();
      });
      return el('label', { class: 'checkbox-field' }, box, f.label);
    }
    return field(f.label, propControl(f, comp), f.hint);
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
    root.appendChild(el('div', { class: 'props-title' }, el('span', { class: 'ico', text: def.icon }), def.label));

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
        el('button', { text: '가로 꽉 채우기', onclick: () => { mutate(() => { comp.x = 0; comp.w = W; }); renderAll(); } }),
        el('button', { text: '가운데 정렬', onclick: () => { mutate(() => { comp.x = Math.round((W - comp.w) / 2); }); renderAll(); } }))));

    const section = el('div', { class: 'props-section' }, el('h4', { text: '속성' }));
    def.fields.forEach((f) => {
      if (f.show && !f.show(comp.props)) return;
      section.appendChild(fieldFor(f, comp));
    });
    if (def.note) section.appendChild(el('div', { class: 'note', text: def.note }));
    root.appendChild(section);

    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '정리' }),
      el('div', { class: 'btn-row' },
        el('button', { text: '맨 앞으로', onclick: () => reorder('front') }),
        el('button', { text: '앞으로', onclick: () => reorder('up') }),
        el('button', { text: '뒤로', onclick: () => reorder('down') }),
        el('button', { text: '맨 뒤로', onclick: () => reorder('back') })),
      el('div', { class: 'btn-row' },
        el('button', { text: '복제', onclick: () => pasteComponent(comp, GRID * 2) }),
        el('button', { class: 'danger', text: '삭제', onclick: deleteSelected }))));
  }

  function renderScreenProps(root) {
    const s = screen();
    const theme = RT.themeOf(project);
    root.appendChild(el('div', { class: 'props-title' }, el('span', { class: 'ico', text: '▯' }), `화면: ${s.name}`));

    const name = el('input', { type: 'text', value: s.name });
    name.addEventListener('input', () => { renameScreen(s, name.value, s.id + ':name'); renderScreens(); renderCanvas(); });
    const isStart = (project.startScreen || project.screens[0].id) === s.id;
    const startBox = el('input', { type: 'checkbox', checked: isStart, disabled: isStart });
    startBox.addEventListener('change', () => { mutate(() => { project.startScreen = s.id; }); renderAll(); });

    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '이 화면' }),
      field('이름', name),
      field('배경색', colorControl(s.bg, theme.bg, (v) => { mutate(() => { s.bg = v; }, s.id + ':bg'); renderCanvas(); })),
      el('label', { class: 'checkbox-field' }, startBox, '앱을 켜면 처음 보이는 화면'),
      el('div', { class: 'btn-row' },
        el('button', { text: '화면 복제', onclick: () => duplicateScreen(s) }),
        el('button', { class: 'danger', text: '화면 삭제', onclick: () => deleteScreen(s) }))));

    const setTheme = (k) => (v) => {
      mutate(() => { project.theme = Object.assign({}, project.theme, { [k]: v || RT.DEFAULT_THEME[k] }); }, 'theme:' + k);
      renderCanvas();
    };
    const font = el('select', { onchange: () => setTheme('font')(font.value) },
      [['system', '기본 고딕'], ['serif', '명조'], ['mono', '고정폭']].map(([v, l]) => el('option', { value: v, text: l })));
    font.value = theme.font;

    root.appendChild(el('div', { class: 'props-section' }, el('h4', { text: '앱 전체 테마' }),
      field('대표 색', colorControl(project.theme && project.theme.primary, RT.DEFAULT_THEME.primary, setTheme('primary')), '헤더, 버튼, 내 말풍선 등 색을 비워둔 오브젝트에 쓰여요'),
      field('기본 배경색', colorControl(project.theme && project.theme.bg, RT.DEFAULT_THEME.bg, setTheme('bg'))),
      field('기본 글자색', colorControl(project.theme && project.theme.text, RT.DEFAULT_THEME.text, setTheme('text'))),
      field('글꼴', font)));

    root.appendChild(el('div', { class: 'note' },
      '① 왼쪽에서 오브젝트를 휴대폰 화면으로 끌어다 놓으세요.', el('br'),
      '② 오브젝트를 누르면 오른쪽에서 글자·색·동작을 바꿀 수 있어요.', el('br'),
      '③ 모서리 핸들로 크기를, 끌어서 위치를 바꿔요.', el('br'),
      '④ ▶ 미리보기로 실제처럼 눌러보고, "앱 내보내기"로 HTML 앱을 받으세요.'));
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
    target.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('text/cm-type')) return;
      e.preventDefault();
      $('#stage').classList.add('drop-target');
    });
    target.addEventListener('dragleave', () => $('#stage').classList.remove('drop-target'));
    target.addEventListener('drop', (e) => {
      $('#stage').classList.remove('drop-target');
      const type = e.dataTransfer.getData('text/cm-type');
      if (!DEFS[type]) return;
      e.preventDefault();
      const pt = stagePoint(e);
      addComponent(type, pt.x, pt.y);
    });
    $('#canvasArea').addEventListener('pointerdown', (e) => {
      if (e.target === $('#canvasArea') && selectedId) select(null);
    });
    window.addEventListener('resize', () => { fitCanvas(size().w, size().h); renderSelection(); });
  }

  // ---------------------------------------------------------------- 키보드

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!$('#previewModal').hidden) {
        if (e.key === 'Escape') closePreview();
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
    modal.hidden = false;
    $('#previewTitle').textContent = `${project.name || '앱'} 미리보기 — 실제처럼 눌러보세요`;
    startPreview(screenId);
  }

  function startPreview(fromScreen) {
    const { w: W, h: H } = size();
    const holder = $('.preview-holder');
    const scale = Math.max(0.2, Math.min(1, (holder.clientWidth - 40) / (W + 20), (holder.clientHeight - 40) / (H + 20)));
    const mount = $('#previewMount');
    RT.mount(mount, project, { screenId: fromScreen });
    mount.firstChild.style.transform = `scale(${scale})`;
    Object.assign($('#previewScreen').style, { width: W * scale + 'px', height: H * scale + 'px' });
  }

  function closePreview() {
    $('#previewModal').hidden = true;
    $('#previewMount').innerHTML = '';
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
      loadProject(data);
      toast(`"${data.name || '앱'}"을(를) 불러왔어요`);
    } catch (err) {
      toast('불러오기 실패: ' + err.message);
    }
  }

  // ---------------------------------------------------------------- 상단 바

  function setupTopbar() {
    const tpl = $('#templateSelect');
    Object.entries(TEMPLATES).forEach(([k, t]) => tpl.appendChild(el('option', { value: k, text: t.label })));
    tpl.addEventListener('change', () => {
      const k = tpl.value;
      tpl.value = '';
      if (!k) return;
      if (!confirm(`"${TEMPLATES[k].label}" 템플릿으로 새로 시작할까요?\n지금 작업은 사라져요. (먼저 "저장"을 누르면 보관할 수 있어요)`)) return;
      loadProject(TEMPLATES[k].build());
    });

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
    $('#exportBtn').addEventListener('click', exportHtml);
    $('#openBtn').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) openFile(e.target.files[0]);
      e.target.value = '';
    });
    $('#addScreenBtn').addEventListener('click', addScreen);
  }

  // ---------------------------------------------------------------- 시작

  RT.injectCSS();
  renderPalette();
  setupTopbar();
  setupCanvas();
  setupKeyboard();
  renderAll();

  // 테스트와 콘솔에서 쓰기 위한 창구
  window.custorming = {
    get project() { return project; },
    buildAppHtml,
    loadProject,
  };
})();
