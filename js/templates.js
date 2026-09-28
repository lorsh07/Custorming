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
      theme: Object.assign({ primary: '#3b82f6', bg: '#ffffff', text: '#0f172a', font: 'pretendard' }, theme),
      startScreen: screens[0].id,
      screens,
    };
  }

  const tabs = 'chat 채팅 = 채팅\nusers 친구 = 친구\nsettings 설정 = 설정';

  const LIGHT_HEADER = { bg: '#ffffff', color: '#0f172a', size: 20 };
  const taskTabs = 'home 홈 = 홈\nlist 할 일 = 할 일\nbell 알림 = 알림\nuser 프로필 = 프로필';

  return {
    tasks: {
      label: '할 일 앱 (MyTasks)',
      build() {
        const tabbar = () => comp('tabbar', 0, 668, W, 72, { items: taskTabs, showLabels: false });
        const home = screen('홈', [
          comp('box', 12, 12, 336, 124, { bg: '#f8fafc', radius: 20 }),
          comp('avatar', 28, 28, 36, 36, { text: '✓' }),
          comp('text', 74, 34, 180, 24, { text: 'MyTasks', size: 17, bold: true }),
          comp('avatar', 300, 28, 36, 36, { text: '지', bg: '#0f172a' }),
          comp('text', 28, 76, 300, 28, { text: '좋은 아침이에요, 지우님', size: 20, bold: true }),
          comp('text', 28, 104, 300, 20, { text: '오늘 할 일이 5개 있어요', size: 14, color: '#64748b' }),
          comp('stat', 12, 152, 336, 96, {}),
          comp('checklist', 12, 264, 336, 156, {}),
          comp('card', 12, 436, 336, 96, { title: '다음 일정', body: '오후 3시 · 디자인 리뷰 회의', target: '' }),
          tabbar(),
        ]);
        const tasks = screen('할 일', [
          comp('header', 0, 0, W, 56, Object.assign({ title: '할 일', right: 'plus' }, LIGHT_HEADER)),
          comp('checklist', 12, 68, 336, 236, { title: '오늘', items: 'x 디자인 파일 검토\n온보딩 화면 출시\n마케팅 팀과 통화\n주간 보고서 작성\n운동 30분' }),
          comp('checklist', 12, 320, 336, 156, { title: '이번 주', items: '분기 계획 정리\nx 팀 회식 장소 예약\n발표 자료 만들기' }),
          comp('button', 12, 600, 336, 52, { label: '할 일 추가', action: 'alert', message: '곧 추가될 기능이에요!' }),
          tabbar(),
        ], '#f8fafc');
        const alerts = screen('알림', [
          comp('header', 0, 0, W, 56, Object.assign({ title: '알림' }, LIGHT_HEADER)),
          comp('list', 0, 56, W, 612, {
            items: '마감 임박|"온보딩 화면 출시"가 오늘까지예요\n새 댓글|민지님이 디자인 파일에 댓글을 남겼어요\n완료 축하 🎉|이번 주에 18개를 끝냈어요\n일정 알림|오후 3시 디자인 리뷰 회의',
            avatars: true, chevron: false,
          }),
          tabbar(),
        ]);
        const profile = screen('프로필', [
          comp('header', 0, 0, W, 56, Object.assign({ title: '프로필' }, LIGHT_HEADER)),
          comp('avatar', 140, 80, 80, 80, { text: '지', bg: '#0f172a' }),
          comp('text', 24, 172, 312, 28, { text: '김지우', size: 20, bold: true, align: 'center' }),
          comp('text', 24, 200, 312, 20, { text: 'jiwoo@example.com', size: 14, align: 'center', color: '#64748b' }),
          comp('toggle', 0, 248, W, 52, { label: '마감 알림', on: true }),
          comp('toggle', 0, 300, W, 52, { label: '매일 아침 요약', on: true }),
          comp('toggle', 0, 352, W, 52, { label: '다크 모드', on: false }),
          comp('button', 24, 428, 312, 48, { label: '로그아웃', variant: 'outline', action: 'alert', message: '로그아웃 되었어요' }),
          tabbar(),
        ]);
        return project('MyTasks', [home, tasks, alerts, profile]);
      },
    },

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
          comp('header', 0, 0, W, 56, { title: '민지', showBack: true, right: 'more' }),
          comp('chat', 0, 56, W, 624, {
            messages: '민지: 안녕! 오늘 뭐 해?\n나: 앱 만드는 중이야 😎\n민지: 오 멋지다! 어떤 앱?',
            autoReply: 'ㅋㅋ 그렇구나!\n진짜? 대박 👍\n"{메시지}" 라니 궁금하다\n좋아 좋아 😊',
            botName: '민지',
          }),
          comp('chatInput', 0, 680, W, 60, {}),
        ], '#f4f4f8');

        const chats = screen('채팅', [
          comp('header', 0, 0, W, 56, { title: '채팅', right: 'plus' }),
          comp('list', 0, 56, W, 620, {
            items: '민지|오늘 저녁 뭐 먹을까?\n준호|내일 회의 자료 보냈어\n디자인팀|새 시안 올렸습니다 🎨\n엄마|밥은 먹었니?\n스터디 모임|이번 주 토요일 2시!',
            avatars: true, chevron: false, target: room.id,
          }),
          comp('tabbar', 0, 676, W, 64, { items: tabs }),
        ]);

        const friends = screen('친구', [
          comp('header', 0, 0, W, 56, { title: '친구', right: 'search' }),
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
        return project('로그인 앱', [login, home]);
      },
    },
  };
})();
