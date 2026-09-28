/* 시작용 템플릿. build()는 매번 새 id로 프로젝트를 만든다. */
window.cmUid = function (prefix) {
  return (prefix || 'c') + Math.random().toString(36).slice(2, 9);
};

window.CM_TEMPLATES = (function () {
  const W = 360;
  const H = 740;

  function comp(type, x, y, w, h, props) {
    const defaults = JSON.parse(JSON.stringify(window.CM_COMPONENTS[type].props));
    return { id: window.cmUid('c'), type, x, y, w, h, props: Object.assign(defaults, props) };
  }

  function screen(name, components, bg) {
    return { id: window.cmUid('s'), name, bg: bg || '', components };
  }

  function project(name, screens, theme) {
    return {
      version: 1,
      name,
      size: { w: W, h: H },
      theme: Object.assign({ primary: '#5b5bf7', bg: '#ffffff', text: '#1d1d1f', font: 'system' }, theme),
      startScreen: screens[0].id,
      screens,
    };
  }

  const tabs = '💬 채팅 = 채팅\n👥 친구 = 친구\n⚙️ 설정 = 설정';

  return {
    blank: {
      label: '빈 앱',
      build() {
        return project('새 앱', [
          screen('홈', [comp('header', 0, 0, W, 56, { title: '새 앱' })]),
        ]);
      },
    },

    chat: {
      label: '메신저 앱',
      build() {
        const room = screen('채팅방', [
          comp('header', 0, 0, W, 56, { title: '민지', showBack: true, right: '⋮' }),
          comp('chat', 0, 56, W, 624, {
            messages: '민지: 안녕! 오늘 뭐 해?\n나: 앱 만드는 중이야 😎\n민지: 오 멋지다! 어떤 앱?',
            autoReply: 'ㅋㅋ 그렇구나!\n진짜? 대박 👍\n"{메시지}" 라니 궁금하다\n좋아 좋아 😊',
            botName: '민지',
          }),
          comp('chatInput', 0, 680, W, 60, {}),
        ], '#f4f4f8');

        const chats = screen('채팅', [
          comp('header', 0, 0, W, 56, { title: '채팅', right: '＋' }),
          comp('list', 0, 56, W, 620, {
            items: '민지|오늘 저녁 뭐 먹을까?\n준호|내일 회의 자료 보냈어\n디자인팀|새 시안 올렸습니다 🎨\n엄마|밥은 먹었니?\n스터디 모임|이번 주 토요일 2시!',
            avatars: true, chevron: false, target: room.id,
          }),
          comp('tabbar', 0, 676, W, 64, { items: tabs }),
        ]);

        const friends = screen('친구', [
          comp('header', 0, 0, W, 56, { title: '친구', right: '🔍' }),
          comp('avatar', 20, 76, 64, 64, { text: '나' }),
          comp('text', 100, 84, 240, 26, { text: '내 프로필', size: 18, bold: true }),
          comp('text', 100, 112, 240, 22, { text: '상태 메시지를 입력하세요', size: 14, color: '#8a8a8e' }),
          comp('divider', 0, 152, W, 16, {}),
          comp('list', 0, 168, W, 508, {
            items: '민지|오늘도 화이팅 💪\n준호|\n서연|여행 중 ✈️\n도윤|',
            avatars: true, chevron: false, target: room.id,
          }),
          comp('tabbar', 0, 676, W, 64, { items: tabs }),
        ]);

        const settings = screen('설정', [
          comp('header', 0, 0, W, 56, { title: '설정' }),
          comp('toggle', 0, 72, W, 52, { label: '알림 받기', on: true }),
          comp('toggle', 0, 124, W, 52, { label: '다크 모드', on: false }),
          comp('toggle', 0, 176, W, 52, { label: '읽음 표시', on: true }),
          comp('divider', 0, 236, W, 16, {}),
          comp('button', 24, 272, 312, 48, { label: '로그아웃', variant: 'outline', action: 'alert', message: '로그아웃 되었어요' }),
          comp('tabbar', 0, 676, W, 64, { items: tabs }),
        ], '#f4f4f8');

        return project('나의 메신저', [chats, friends, settings, room]);
      },
    },

    login: {
      label: '로그인 + 홈',
      build() {
        const home = screen('홈', [
          comp('header', 0, 0, W, 56, { title: '홈', align: 'center' }),
          comp('text', 24, 80, 312, 34, { text: '안녕하세요 👋', size: 24, bold: true }),
          comp('text', 24, 116, 312, 24, { text: '오늘도 좋은 하루 보내세요.', size: 15, color: '#6e6e73' }),
          comp('card', 24, 160, 312, 110, { title: '오늘의 할 일', body: '• 앱 화면 구성하기\n• 색상 정하기' }),
          comp('card', 24, 286, 312, 110, { title: '공지사항', body: '새로운 기능이 추가되었어요!' }),
          comp('button', 24, 660, 312, 48, { label: '로그아웃', variant: 'text', action: 'go', target: '' }),
        ], '#f4f4f8');

        const login = screen('로그인', [
          comp('avatar', 140, 110, 80, 80, { text: '✦' }),
          comp('text', 24, 212, 312, 36, { text: '환영합니다', size: 26, bold: true, align: 'center' }),
          comp('text', 24, 250, 312, 24, { text: '계정에 로그인하세요', size: 15, align: 'center', color: '#6e6e73' }),
          comp('input', 24, 304, 312, 72, { label: '이메일', placeholder: 'you@example.com', inputType: 'email' }),
          comp('input', 24, 388, 312, 72, { label: '비밀번호', placeholder: '비밀번호', inputType: 'password' }),
          comp('button', 24, 488, 312, 52, { label: '로그인', action: 'go', target: home.id }),
          comp('button', 24, 552, 312, 40, { label: '회원가입', variant: 'text', action: 'alert', message: '준비 중이에요!', size: 14 }),
        ]);

        home.components[home.components.length - 1].props.target = login.id;
        return project('로그인 앱', [login, home], { primary: '#0a84ff' });
      },
    },
  };
})();
