/*
 * 휴대폰 기종별 틀.
 * w, h     : 화면 크기 (CSS px, 앱을 배치하는 캔버스 크기)
 * radius   : 화면 모서리 둥글기
 * bezel    : 테두리 두께
 * cutout   : 화면 위쪽 모양  island(다이내믹 아일랜드) · notch(노치) · punch(펀치홀) · home(홈 버튼) · none
 * os       : 상태 표시줄 모양 ios · android
 */
window.CM_DEVICES = (function () {
  'use strict';

  const list = [
    { id: 'basic', label: '기본 폰', group: '기본', w: 360, h: 740, radius: 36, bezel: 9, cutout: 'none', os: 'ios' },

    { id: 'iphone15pro', label: 'iPhone 15 Pro', group: 'iPhone', w: 393, h: 852, radius: 55, bezel: 10, cutout: 'island', os: 'ios' },
    { id: 'iphone15promax', label: 'iPhone 15 Pro Max', group: 'iPhone', w: 430, h: 932, radius: 55, bezel: 10, cutout: 'island', os: 'ios' },
    { id: 'iphone14', label: 'iPhone 14', group: 'iPhone', w: 390, h: 844, radius: 47, bezel: 11, cutout: 'notch', os: 'ios' },
    { id: 'iphone13mini', label: 'iPhone 13 mini', group: 'iPhone', w: 375, h: 812, radius: 44, bezel: 11, cutout: 'notch', os: 'ios' },
    { id: 'iphonese', label: 'iPhone SE', group: 'iPhone', w: 375, h: 667, radius: 0, bezel: 12, cutout: 'home', os: 'ios' },

    { id: 'galaxys24', label: 'Galaxy S24', group: 'Galaxy', w: 360, h: 780, radius: 34, bezel: 8, cutout: 'punch', os: 'android' },
    { id: 'galaxys24ultra', label: 'Galaxy S24 Ultra', group: 'Galaxy', w: 384, h: 824, radius: 14, bezel: 8, cutout: 'punch', os: 'android' },
    { id: 'galaxyzflip5', label: 'Galaxy Z Flip5', group: 'Galaxy', w: 360, h: 880, radius: 30, bezel: 9, cutout: 'punch', os: 'android' },

    { id: 'pixel8', label: 'Pixel 8', group: '기타 안드로이드', w: 412, h: 915, radius: 44, bezel: 10, cutout: 'punch', os: 'android' },

    { id: 'ipadmini', label: 'iPad mini', group: '태블릿', w: 744, h: 1133, radius: 21, bezel: 20, cutout: 'none', os: 'ios' },
    { id: 'galaxytabs9', label: 'Galaxy Tab S9', group: '태블릿', w: 800, h: 1280, radius: 18, bezel: 16, cutout: 'none', os: 'android' },
  ];

  const CUSTOM = { id: 'custom', label: '직접 입력', group: '직접 입력', radius: 30, bezel: 9, cutout: 'none', os: 'android' };

  const colors = [
    ['graphite', '#475569', '그래파이트'],
    ['black', '#15171c', '블랙'],
    ['silver', '#d5d8de', '실버'],
    ['gold', '#e3cfae', '골드'],
    ['blue', '#3f5a7a', '블루'],
    ['pink', '#f0c6cf', '핑크'],
  ];

  // 프로젝트의 기종. 예전 프로젝트는 크기가 같은 기종을 찾고, 없으면 "직접 입력"으로 본다.
  function of(project) {
    const size = project.size || { w: 360, h: 740 };
    const byId = list.find((d) => d.id === project.device);
    if (byId && byId.w === size.w && byId.h === size.h) return byId;
    const bySize = !project.device && list.find((d) => d.w === size.w && d.h === size.h);
    if (bySize) return bySize;
    return Object.assign({}, CUSTOM, { w: size.w, h: size.h });
  }

  function colorOf(project) {
    const hit = colors.find((c) => c[0] === project.frameColor);
    return (hit || colors[0])[1];
  }

  function statusHeight(d) {
    if (d.cutout === 'island') return 54;
    if (d.cutout === 'notch') return 47;
    if (d.cutout === 'home') return 20;
    return d.os === 'android' ? 30 : 24;
  }

  const homeBezel = (d) => (d.cutout === 'home' ? 70 : 0);

  // 확대 배율 1일 때 틀이 차지하는 추가 크기 (화면에 맞추기 계산용)
  function extra(d) {
    return { w: d.bezel * 2, h: d.bezel * 2 + statusHeight(d) + homeBezel(d) * 2 };
  }

  function child(parent, cls, before) {
    let n = parent.querySelector(':scope > .' + cls);
    if (!n) {
      n = document.createElement('div');
      n.className = cls;
      if (before) parent.insertBefore(n, before);
      else parent.appendChild(n);
    }
    return n;
  }

  // .phone 요소를 기종에 맞게 꾸민다. (.status-bar, .phone-screen 은 이미 들어 있다)
  function applyFrame(phone, d, zoom, color) {
    const z = zoom;
    const px = (v) => v * z + 'px';
    phone.dataset.cutout = d.cutout;
    phone.dataset.os = d.os;
    phone.style.setProperty('--frame', color);
    phone.style.borderWidth = Math.max(3, Math.round(d.bezel * z)) + 'px';
    phone.style.borderRadius = d.cutout === 'home' ? px(56) : px(d.radius + d.bezel);

    const screen = phone.querySelector('.phone-screen');
    const bar = phone.querySelector('.status-bar');

    // 홈 버튼이 있는 기종(iPhone SE)은 위아래에 넓은 테두리가 있다
    const top = child(phone, 'bezel-top', bar);
    const bottom = child(phone, 'bezel-bottom');
    top.hidden = bottom.hidden = d.cutout !== 'home';
    top.style.height = bottom.style.height = px(homeBezel(d));
    top.innerHTML = '<span class="speaker"></span>';
    bottom.innerHTML = '<span class="home-button"></span>';
    top.firstChild.style.cssText = `width:${px(48)};height:${px(5)};`;
    bottom.firstChild.style.cssText = `width:${px(46)};height:${px(46)};`;

    // 상태 표시줄
    const h = statusHeight(d);
    Object.assign(bar.style, {
      height: px(h),
      fontSize: Math.max(7, (d.os === 'ios' ? 14 : 12) * z) + 'px',
      padding: d.os === 'ios' ? `0 ${px(30)} ${px(d.cutout === 'island' ? 14 : 8)}` : `0 ${px(18)} ${px(6)}`,
    });
    bar.firstChild.textContent = d.os === 'ios' ? '9:41' : '12:30';
    const icons = bar.querySelector('.status-icons');
    icons.style.transform = `scale(${Math.max(0.5, z)})`;
    icons.style.transformOrigin = 'right bottom';

    // 화면 위쪽 모양
    const cut = child(bar, 'cutout');
    cut.hidden = !['island', 'notch', 'punch'].includes(d.cutout);
    const s = {
      island: { width: px(122), height: px(35), top: px(11), borderRadius: px(20) },
      notch: { width: px(158), height: px(32), top: '0', borderRadius: `0 0 ${px(20)} ${px(20)}` },
      punch: { width: px(11), height: px(11), top: px(10), borderRadius: '50%' },
    }[d.cutout];
    if (s) Object.assign(cut.style, s);

    // 아래쪽 홈 막대 (홈 버튼 기종은 없음)
    const bar2 = child(phone, 'home-indicator');
    bar2.hidden = d.cutout === 'home';
    Object.assign(bar2.style, {
      width: px(d.os === 'ios' ? 134 : 108),
      height: px(d.os === 'ios' ? 5 : 4),
      bottom: px(8),
    });

    // 둥근 화면 모서리 (상태 표시줄은 틀에 붙어 있어서 아래쪽만 따로 깎는다)
    screen.style.borderRadius = d.cutout === 'home' ? '0' : `0 0 ${px(d.radius)} ${px(d.radius)}`;
  }

  return { list, CUSTOM, colors, of, colorOf, extra, applyFrame };
})();
