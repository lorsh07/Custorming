/*
 * Custorming 런타임
 * 프로젝트 정의(JSON)를 실제 화면으로 그린다.
 * 에디터 캔버스, 미리보기, 내보낸 HTML 앱이 모두 이 코드를 공유한다.
 *
 * 주의: 내보내기 시 createCustormingRuntime.toString() 으로 직렬화되므로
 * 이 함수 바깥의 어떤 변수나 함수도 참조하면 안 된다.
 */
function createCustormingRuntime() {
  'use strict';

  const DEFAULT_SIZE = { w: 360, h: 740 };
  const DEFAULT_THEME = { primary: '#3b82f6', bg: '#ffffff', text: '#0f172a', font: 'pretendard' };
  const PRETENDARD_CSS = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
  const FONTS = {
    pretendard: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    system: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", "Segoe UI", Roboto, sans-serif',
    serif: '"Nanum Myeongjo", "AppleMyungjo", Georgia, serif',
    mono: '"D2Coding", "SFMono-Regular", Menlo, Consolas, monospace',
  };

  const CSS = `
.cm-stage{position:relative;overflow:hidden;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.cm-screen{position:absolute;inset:0;overflow:hidden}
.cm-comp{position:absolute;box-sizing:border-box}
.cm-comp *{box-sizing:border-box}
.cm-fill{width:100%;height:100%}
.cm-comp button{font:inherit;border:none;cursor:pointer;margin:0}
.cm-comp input{font:inherit;margin:0;outline:none}
.cm-comp input:focus{border-color:var(--cm-primary)!important}
.cm-chat{scroll-behavior:smooth}
.cm-chat::-webkit-scrollbar,.cm-list::-webkit-scrollbar{width:0}
.cm-bubble{max-width:78%;padding:8px 12px;border-radius:16px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
.cm-new{animation:cm-pop .22s ease-out}
@keyframes cm-pop{from{opacity:0;transform:translateY(6px)}}
.cm-press:active{filter:brightness(.92);transform:scale(.98)}
.cm-row:active{background:rgba(0,0,0,.04)}
.cm-switch{position:relative;width:46px;height:28px;border-radius:14px;flex:none;transition:background .2s}
.cm-switch::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}
.cm-switch.on::after{transform:translateX(18px)}
.cm-toast{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(20,20,24,.92);color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;max-width:80%;text-align:center;z-index:99999;animation:cm-pop .2s ease-out;white-space:pre-wrap}
`;

  // 24×24 선 아이콘. 탭 바에서 "home = 홈" 처럼 이름으로 쓴다
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    heart: '<path d="M19.5 12.6 12 20l-7.5-7.4a5 5 0 1 1 7.5-6.6 5 5 0 1 1 7.5 6.6z"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
  };

  function icon(name, size, strokeWidth) {
    const span = document.createElement('span');
    span.style.display = 'inline-flex';
    span.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (strokeWidth || 2) +
      '" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
    return span;
  }

  // 아이콘 이름이면 SVG, 아니면 이모지/글자 그대로
  function iconOrText(value, size) {
    if (ICONS[value]) return icon(value, size);
    return h('span', { fontSize: size + 'px', lineHeight: '1' }, value);
  }

  function injectFont(theme) {
    if (theme.font !== 'pretendard' || document.getElementById('cm-pretendard')) return;
    const link = document.createElement('link');
    link.id = 'cm-pretendard';
    link.rel = 'stylesheet';
    link.href = PRETENDARD_CSS;
    document.head.appendChild(link);
  }

  function injectCSS() {
    if (document.getElementById('cm-runtime-css')) return;
    const style = document.createElement('style');
    style.id = 'cm-runtime-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function h(tag, style, children, className) {
    const n = document.createElement(tag);
    if (style) Object.assign(n.style, style);
    if (className) n.className = className;
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null || c === false) return;
        n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return n;
  }

  function lines(str) {
    return String(str || '').split('\n').map((s) => s.trim()).filter(Boolean);
  }

  function px(v, fallback) {
    const n = Number(v);
    return (Number.isFinite(n) ? n : fallback) + 'px';
  }

  function sizeOf(project) {
    return Object.assign({}, DEFAULT_SIZE, project.size);
  }

  function themeOf(project) {
    return Object.assign({}, DEFAULT_THEME, project.theme);
  }

  function findScreen(project, ref) {
    if (!ref) return null;
    const key = String(ref).trim();
    return project.screens.find((s) => s.id === key) || project.screens.find((s) => s.name === key) || null;
  }

  // "이름: 내용" 한 줄 = 메시지 하나. 이름이 "나" 또는 "me" 면 내가 보낸 메시지.
  function parseMessages(str) {
    return lines(str).map((line) => {
      const m = line.match(/^([^:：]{1,16})\s*[:：]\s*(.*)$/);
      const name = m ? m[1].trim() : '상대';
      const text = m ? m[2] : line;
      return { me: /^(나|me)$/i.test(name), name, text };
    });
  }

  // "아이콘 이름 = 화면" 한 줄 = 탭 하나
  function parseTabs(str) {
    return lines(str).map((line) => {
      const [label, target] = line.split('=').map((s) => s.trim());
      const m = label.match(/^(\S+)\s+(.+)$/);
      if (m && (ICONS[m[1]] || !/[\p{L}\p{N}]/u.test(m[1]))) return { icon: m[1], label: m[2], target: target || m[2] };
      if (ICONS[label]) return { icon: label, label: '', target: target || label };
      return { icon: '', label, target: target || label };
    });
  }

  // "제목|부제" 한 줄 = 항목 하나
  function parseItems(str) {
    return lines(str).map((line) => {
      const [title, sub] = line.split('|').map((s) => s.trim());
      return { title, sub: sub || '' };
    });
  }

  function paintChat(box, messages, p, t, animateFrom) {
    box.innerHTML = '';
    messages.forEach((m, i) => {
      const row = h('div', {
        display: 'flex', flexDirection: 'column',
        alignItems: m.me ? 'flex-end' : 'flex-start', gap: '3px',
      }, null, i >= animateFrom ? 'cm-new' : '');
      if (!m.me && p.showNames) row.appendChild(h('div', { fontSize: '12px', color: '#8a8a8e', padding: '0 4px' }, m.name));
      row.appendChild(h('div', {
        background: m.me ? (p.meColor || t.primary) : (p.otherColor || '#eeeef2'),
        color: m.me ? (p.meTextColor || '#fff') : (p.otherTextColor || t.text),
        fontSize: px(p.fontSize, 14),
        borderBottomRightRadius: m.me ? '4px' : '16px',
        borderBottomLeftRadius: m.me ? '16px' : '4px',
      }, m.text, 'cm-bubble'));
      box.appendChild(row);
    });
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  }

  const renderers = {
    header(p, ctx) {
      const bar = h('div', {
        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px',
        background: p.bg || ctx.theme.primary, color: p.color || '#fff',
        fontSize: px(p.size, 18), fontWeight: '700',
      }, null, 'cm-fill');
      if (p.showBack) {
        const b = h('button', { background: 'none', color: 'inherit', display: 'flex', padding: '0 4px 0 0', marginLeft: '-6px' }, icon('back', 26));
        b.onclick = () => ctx.back();
        bar.appendChild(b);
      }
      bar.appendChild(h('div', {
        flex: '1', textAlign: p.align || 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }, p.title || ''));
      if (p.right) bar.appendChild(h('div', { display: 'flex', opacity: '.9' }, iconOrText(p.right, 22)));
      return bar;
    },

    chat(p, ctx, comp) {
      const box = h('div', {
        background: p.bg || 'transparent', padding: '12px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }, null, 'cm-fill cm-chat');
      paintChat(box, ctx.chatMessages(comp), p, ctx.theme, Infinity);
      ctx.registerChat(comp, box);
      return box;
    },

    chatInput(p, ctx) {
      const form = h('form', {
        display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 10px',
        background: p.bg || '#ffffff', borderTop: '1px solid rgba(0,0,0,.08)',
      }, null, 'cm-fill');
      const input = h('input', {
        flex: '1', minWidth: '0', height: '40px', borderRadius: '20px', border: '1px solid #dcdce2',
        padding: '0 14px', fontSize: '15px', background: '#fff', color: '#1d1d1f',
      });
      input.placeholder = p.placeholder || '';
      const btn = h('button', {
        height: '40px', padding: '0 16px', borderRadius: '20px', fontWeight: '600', fontSize: '14px',
        background: p.buttonColor || ctx.theme.primary, color: '#fff', flex: 'none',
      }, p.buttonText || '전송', 'cm-press');
      btn.type = 'submit';
      form.append(input, btn);
      form.onsubmit = (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return;
        ctx.send(v);
        input.value = '';
        input.focus();
      };
      return form;
    },

    text(p, ctx) {
      return h('div', {
        color: p.color || ctx.theme.text, fontSize: px(p.size, 16), fontWeight: p.bold ? '700' : '400',
        textAlign: p.align || 'left', whiteSpace: 'pre-wrap', lineHeight: '1.4', overflow: 'hidden',
      }, p.text || '', 'cm-fill');
    },

    button(p, ctx) {
      const variant = p.variant || 'filled';
      const color = p.bg || ctx.theme.primary;
      const b = h('button', {
        background: variant === 'filled' ? color : 'transparent',
        color: p.color || (variant === 'filled' ? '#fff' : color),
        border: variant === 'outline' ? '1.5px solid ' + color : 'none',
        borderRadius: px(p.radius, 12), fontSize: px(p.size, 16), fontWeight: '600',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px',
      }, p.label || '', 'cm-fill cm-press');
      b.onclick = () => ctx.action(p);
      return b;
    },

    image(p) {
      const style = { borderRadius: px(p.radius, 0), overflow: 'hidden', display: 'block' };
      if (!p.src) {
        return h('div', Object.assign(style, {
          background: 'linear-gradient(135deg,#dfe3ff,#f4e3ff)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: '#7a7aa8',
        }), icon('image', 36, 1.6), 'cm-fill');
      }
      const img = h('img', Object.assign(style, { objectFit: p.fit || 'cover' }), null, 'cm-fill');
      img.src = p.src;
      img.alt = '';
      img.draggable = false;
      return img;
    },

    input(p, ctx) {
      const wrap = h('label', { display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }, null, 'cm-fill');
      if (p.label) wrap.appendChild(h('span', { fontSize: '13px', color: '#6e6e73', fontWeight: '600' }, p.label));
      const input = h('input', {
        width: '100%', flex: '1', minHeight: '0', border: '1px solid #dcdce2', borderRadius: px(p.radius, 10),
        padding: '0 14px', fontSize: '15px', background: '#fff', color: ctx.theme.text,
      });
      input.type = p.inputType || 'text';
      input.placeholder = p.placeholder || '';
      wrap.appendChild(input);
      return wrap;
    },

    list(p, ctx) {
      const box = h('div', { background: p.bg || 'transparent', overflowY: 'auto' }, null, 'cm-fill cm-list');
      parseItems(p.items).forEach((item) => {
        const row = h('div', {
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
          borderBottom: '1px solid rgba(0,0,0,.06)', cursor: p.target ? 'pointer' : 'default',
        }, null, 'cm-row');
        if (p.avatars) {
          row.appendChild(h('div', {
            width: '44px', height: '44px', borderRadius: '50%', flex: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700',
            background: ctx.theme.primary, fontSize: '17px',
          }, Array.from(item.title)[0] || ''));
        }
        const texts = h('div', { flex: '1', minWidth: '0' });
        texts.appendChild(h('div', { fontSize: '16px', color: p.color || ctx.theme.text, fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, item.title));
        if (item.sub) texts.appendChild(h('div', { fontSize: '13px', color: '#8a8a8e', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, item.sub));
        row.appendChild(texts);
        if (p.chevron) row.appendChild(h('div', { color: '#c4c4c8', fontSize: '20px' }, '›'));
        if (p.target) row.onclick = () => ctx.go(p.target);
        box.appendChild(row);
      });
      return box;
    },

    card(p, ctx) {
      const card = h('div', {
        background: p.bg || '#ffffff', borderRadius: px(p.radius, 16), padding: '16px', overflow: 'hidden',
        boxShadow: p.shadow ? '0 4px 16px rgba(0,0,0,.08)' : 'none',
        border: p.shadow ? 'none' : '1px solid rgba(0,0,0,.08)', cursor: p.target ? 'pointer' : 'default',
      }, null, 'cm-fill' + (p.target ? ' cm-press' : ''));
      if (p.title) card.appendChild(h('div', { fontSize: '17px', fontWeight: '700', color: ctx.theme.text, marginBottom: '6px' }, p.title));
      if (p.body) card.appendChild(h('div', { fontSize: '14px', color: '#6e6e73', lineHeight: '1.5', whiteSpace: 'pre-wrap' }, p.body));
      if (p.target) card.onclick = () => ctx.go(p.target);
      return card;
    },

    tabbar(p, ctx) {
      const pill = p.style === 'pill';
      const bar = h('div', {
        display: 'flex', background: p.bg || '#ffffff', borderTop: '1px solid rgba(0,0,0,.06)',
        padding: pill ? '8px 10px' : '0', gap: pill ? '6px' : '0',
      }, null, 'cm-fill');
      parseTabs(p.items).forEach((tab) => {
        const target = findScreen(ctx.project, tab.target);
        const active = target && target.id === ctx.screen.id;
        const accent = p.activeColor || ctx.theme.primary;
        const color = active ? accent : (p.color || '#94a3b8');
        const btn = h('button', {
          flex: '1', color, display: 'flex', flexDirection: 'column', borderRadius: '14px',
          background: pill && active ? 'color-mix(in srgb, ' + accent + ' 12%, transparent)' : 'none',
          alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '11px', fontWeight: active ? '700' : '500',
        });
        if (tab.icon) {
          const ic = iconOrText(tab.icon, 22);
          if (!ICONS[tab.icon] && !active) Object.assign(ic.style, { filter: 'grayscale(1)', opacity: '.7' });
          btn.appendChild(ic);
        }
        if (tab.label && p.showLabels !== false) btn.appendChild(h('span', null, tab.label));
        btn.onclick = () => ctx.go(tab.target, { replace: true });
        bar.appendChild(btn);
      });
      return bar;
    },

    checklist(p, ctx, comp) {
      const accent = p.color || ctx.theme.primary;
      const items = ctx.getState(comp.id, null) || lines(p.items).map((line) => {
        const m = line.match(/^(\[x\]|x)\s+(.*)$/i);
        return { done: !!m, text: m ? m[2] : line };
      });
      const card = h('div', {
        background: p.bg || '#ffffff', borderRadius: px(p.radius, 16), padding: '14px 16px',
        border: '1px solid rgba(15,23,42,.08)', boxShadow: '0 1px 2px rgba(15,23,42,.04)', overflow: 'hidden',
      }, null, 'cm-fill');
      if (p.title) card.appendChild(h('div', { fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }, p.title));
      items.forEach((item) => {
        const row = h('div', { display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 0', cursor: 'pointer' });
        const box = h('div', {
          width: '22px', height: '22px', borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: item.done ? 'none' : '1.5px solid #cbd5e1', background: item.done ? accent : 'transparent', color: '#fff',
        }, item.done ? icon('check', 14, 3) : null);
        const label = h('div', {
          fontSize: '15px', color: item.done ? '#94a3b8' : ctx.theme.text, textDecoration: item.done ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }, item.text);
        row.append(box, label);
        row.onclick = () => {
          item.done = !item.done;
          ctx.setState(comp.id, items);
          card.replaceWith(renderers.checklist(p, ctx, comp));
        };
        card.appendChild(row);
      });
      return card;
    },

    stat(p, ctx) {
      const card = h('div', {
        background: p.bg || 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: p.color || '#fff',
        borderRadius: px(p.radius, 16), padding: '16px 18px', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px',
        boxShadow: '0 8px 20px rgba(124,58,237,.18)',
      }, null, 'cm-fill');
      card.appendChild(h('div', { fontSize: '13px', opacity: '.85' }, p.label || ''));
      card.appendChild(h('div', { fontSize: px(p.size, 28), fontWeight: '800', lineHeight: '1.1' }, p.value || ''));
      if (p.badge) {
        card.appendChild(h('div', {
          position: 'absolute', right: '16px', bottom: '16px', fontSize: '12px', fontWeight: '600',
          background: 'rgba(255,255,255,.22)', padding: '3px 9px', borderRadius: '999px',
        }, p.badge));
      }
      return card;
    },

    divider(p) {
      const wrap = h('div', { display: 'flex', alignItems: 'center' }, null, 'cm-fill');
      wrap.appendChild(h('div', { width: '100%', height: px(p.thickness, 1), background: p.color || 'rgba(0,0,0,.1)' }));
      return wrap;
    },

    toggle(p, ctx, comp) {
      let on = ctx.getState(comp.id, !!p.on);
      const row = h('div', { display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', cursor: 'pointer' }, null, 'cm-fill');
      row.appendChild(h('div', { flex: '1', fontSize: '16px', color: ctx.theme.text }, p.label || ''));
      const sw = h('div', null, null, 'cm-switch');
      const paint = () => {
        sw.classList.toggle('on', on);
        sw.style.background = on ? (p.color || ctx.theme.primary) : '#d4d4d8';
      };
      paint();
      row.appendChild(sw);
      row.onclick = () => { on = !on; ctx.setState(comp.id, on); paint(); };
      return row;
    },

    avatar(p, ctx, comp) {
      const size = Math.min(comp.w, comp.h);
      const circle = h('div', {
        width: size + 'px', height: size + 'px', borderRadius: '50%', overflow: 'hidden', margin: 'auto',
        background: p.bg || ctx.theme.primary, color: p.color || '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.42) + 'px', fontWeight: '700',
      });
      if (p.src) {
        const img = h('img', { width: '100%', height: '100%', objectFit: 'cover' });
        img.src = p.src;
        img.alt = '';
        img.draggable = false;
        circle.appendChild(img);
      } else {
        circle.textContent = p.text || '';
      }
      return h('div', { display: 'flex' }, circle, 'cm-fill');
    },

    box(p) {
      return h('div', {
        background: p.bg || 'transparent', borderRadius: px(p.radius, 0),
        border: Number(p.borderWidth) > 0 ? px(p.borderWidth, 0) + ' solid ' + (p.borderColor || '#dcdce2') : 'none',
        boxShadow: p.shadow ? '0 4px 16px rgba(0,0,0,.08)' : 'none',
      }, null, 'cm-fill');
    },
  };

  function renderComponent(comp, ctx) {
    const wrap = h('div', {
      left: comp.x + 'px', top: comp.y + 'px', width: comp.w + 'px', height: comp.h + 'px',
    }, null, 'cm-comp cm-' + comp.type);
    wrap.dataset.id = comp.id;
    const render = renderers[comp.type];
    if (render) {
      try {
        wrap.appendChild(render(comp.props || {}, ctx, comp));
      } catch (err) {
        wrap.appendChild(h('div', { color: 'red', fontSize: '11px' }, '렌더링 오류: ' + err.message));
      }
    }
    return wrap;
  }

  function renderScreen(screen, project, ctx) {
    const el = h('div', { background: screen.bg || ctx.theme.bg }, null, 'cm-screen');
    el.dataset.screen = screen.id;
    screen.components.forEach((c) => el.appendChild(renderComponent(c, ctx)));
    return el;
  }

  function styleStage(stage, project) {
    const size = sizeOf(project);
    const theme = themeOf(project);
    injectFont(theme);
    stage.classList.add('cm-stage');
    Object.assign(stage.style, {
      width: size.w + 'px', height: size.h + 'px',
      fontFamily: FONTS[theme.font] || FONTS.system, color: theme.text,
    });
    stage.style.setProperty('--cm-primary', theme.primary);
  }

  // 편집용: 동작 없이 모양만 그리는 컨텍스트
  function staticContext(project, screen) {
    const noop = () => {};
    return {
      live: false, project, screen, theme: themeOf(project),
      chatMessages: (comp) => parseMessages(comp.props.messages),
      registerChat: noop, send: noop, go: noop, back: noop, action: noop,
      getState: (id, fallback) => fallback, setState: noop,
    };
  }

  // 실제로 동작하는 앱을 root 안에 띄운다
  function mount(root, project, opts) {
    opts = opts || {};
    injectCSS();
    root.innerHTML = '';
    const stage = h('div');
    styleStage(stage, project);
    root.appendChild(stage);

    const state = { current: null, history: [], chats: {}, chatEls: {}, values: {} };
    const theme = themeOf(project);

    function screen() {
      return findScreen(project, state.current) || project.screens[0];
    }

    function draw() {
      state.chatEls = {};
      stage.innerHTML = '';
      stage.appendChild(renderScreen(screen(), project, ctx));
    }

    function go(ref, o) {
      o = o || {};
      const target = findScreen(project, ref);
      if (!target) return toast('"' + ref + '" 화면을 찾을 수 없어요');
      if (o.replace) state.history = [];
      else if (state.current && state.current !== target.id) state.history.push(state.current);
      state.current = target.id;
      draw();
    }

    function back() {
      const prev = state.history.pop();
      if (prev) { state.current = prev; draw(); }
    }

    function toast(msg) {
      const t = h('div', null, msg, 'cm-toast');
      stage.appendChild(t);
      setTimeout(() => t.remove(), 1800);
    }

    function chatMessages(comp) {
      if (!state.chats[comp.id]) state.chats[comp.id] = parseMessages(comp.props.messages);
      return state.chats[comp.id];
    }

    function pushMessage(comp, msg) {
      const list = chatMessages(comp);
      list.push(msg);
      const box = state.chatEls[comp.id];
      if (box && box.isConnected) paintChat(box, list, comp.props, theme, list.length - 1);
    }

    function send(text) {
      const chats = screen().components.filter((c) => c.type === 'chat');
      if (!chats.length) return toast('이 화면에 메시지 창이 없어요');
      chats.forEach((comp) => {
        pushMessage(comp, { me: true, name: '나', text });
        const replies = lines(comp.props.autoReply);
        if (!replies.length) return;
        const reply = replies[Math.floor(Math.random() * replies.length)].split('{메시지}').join(text);
        setTimeout(() => pushMessage(comp, { me: false, name: comp.props.botName || '상대', text: reply }), 700);
      });
    }

    function action(p) {
      switch (p.action) {
        case 'go': return p.target ? go(p.target) : toast('이동할 화면이 지정되지 않았어요');
        case 'back': return back();
        case 'alert': return toast(p.message || '');
        case 'send': return p.message ? send(p.message) : null;
        case 'link': return p.url ? window.open(p.url, '_blank', 'noopener') : null;
        default: return null;
      }
    }

    const ctx = {
      live: true, project, theme,
      get screen() { return screen(); },
      chatMessages,
      registerChat: (comp, el) => { state.chatEls[comp.id] = el; },
      send, go, back, action, toast,
      getState: (id, fallback) => (id in state.values ? state.values[id] : fallback),
      setState: (id, v) => { state.values[id] = v; },
    };

    go(opts.screenId || project.startScreen || project.screens[0].id, { replace: true });
    return { go, back, stage };
  }

  // 내보낸 HTML 앱의 진입점: 화면 크기에 맞춰 확대/축소해서 띄운다
  function boot(root, project) {
    const size = sizeOf(project);
    const theme = themeOf(project);
    document.documentElement.style.height = '100%';
    Object.assign(document.body.style, { margin: '0', height: '100%', background: theme.bg });
    const holder = h('div', {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    });
    const frame = h('div', { width: size.w + 'px', height: size.h + 'px', flex: 'none', position: 'relative' });
    holder.appendChild(frame);
    root.appendChild(holder);
    mount(frame, project);
    const fit = () => {
      const s = Math.min(window.innerWidth / size.w, window.innerHeight / size.h);
      frame.style.transform = 'scale(' + s + ')';
    };
    window.addEventListener('resize', fit);
    fit();
  }

  return {
    DEFAULT_SIZE, DEFAULT_THEME, FONTS, ICONS, icon,
    injectCSS, styleStage, renderScreen, renderComponent, staticContext, mount, boot,
    themeOf, sizeOf, findScreen, parseMessages,
  };
}
