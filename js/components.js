/*
 * 팔레트에 올라가는 오브젝트 정의.
 * - w: 'full' 이면 화면 너비에 맞춤
 * - dock: 'top' | 'bottom' 이면 처음 놓을 때 화면 위/아래에 붙임
 * - props: 기본 속성값 (색상의 빈 문자열 = 테마 색 사용)
 * - fields: 속성 패널에 보여줄 입력 칸
 */
window.CM_COMPONENTS = (function () {
  // fallback: 비워뒀을 때 쓰이는 색. 'primary' / 'text' 는 테마 색
  const COLOR = (key, label, fallback) => ({ key, label, type: 'color', fallback: fallback || '' });
  const SIZE = (key, label, min, max) => ({ key, label, type: 'number', min, max });

  return {
    header: {
      label: '헤더', icon: '▔', group: '레이아웃', w: 'full', h: 56, dock: 'top',
      props: { title: '제목', align: 'left', showBack: false, right: '', size: 18, bg: '', color: '' },
      fields: [
        { key: 'title', label: '제목', type: 'text' },
        { key: 'align', label: '정렬', type: 'select', options: [['left', '왼쪽'], ['center', '가운데']] },
        { key: 'showBack', label: '뒤로가기 버튼 표시', type: 'checkbox' },
        { key: 'right', label: '오른쪽 아이콘', type: 'text', hint: '이모지나 기호 (예: ⋮ ＋ 🔍)' },
        SIZE('size', '글자 크기', 10, 40),
        COLOR('bg', '배경색', 'primary'),
        COLOR('color', '글자색', '#ffffff'),
      ],
    },

    tabbar: {
      label: '탭 바', icon: '▁', group: '레이아웃', w: 'full', h: 64, dock: 'bottom',
      props: { items: '🏠 홈 = 홈\n💬 채팅 = 채팅\n⚙️ 설정 = 설정', bg: '', activeColor: '', color: '' },
      fields: [
        { key: 'items', label: '탭 목록', type: 'textarea', rows: 4, hint: '한 줄에 하나씩 "아이콘 이름 = 이동할 화면 이름"' },
        COLOR('bg', '배경색', '#ffffff'),
        COLOR('activeColor', '선택된 탭 색', 'primary'),
        COLOR('color', '기본 탭 색', '#9a9aa0'),
      ],
    },

    box: {
      label: '박스', icon: '▢', group: '레이아웃', w: 320, h: 120,
      props: { bg: '#f2f2f7', radius: 16, borderWidth: 0, borderColor: '', shadow: false },
      fields: [
        COLOR('bg', '배경색'),
        SIZE('radius', '모서리 둥글기', 0, 200),
        SIZE('borderWidth', '테두리 두께', 0, 20),
        COLOR('borderColor', '테두리 색', '#dcdce2'),
        { key: 'shadow', label: '그림자', type: 'checkbox' },
      ],
    },

    divider: {
      label: '구분선', icon: '―', group: '레이아웃', w: 'full', h: 16,
      props: { thickness: 1, color: '' },
      fields: [SIZE('thickness', '두께', 1, 20), COLOR('color', '색')],
    },

    chat: {
      label: '메시지 창', icon: '💬', group: '메시지', w: 'full', h: 520,
      props: {
        messages: '상대: 안녕하세요!\n나: 반가워요 👋',
        autoReply: '좋아요!\n그렇군요 😊\n"{메시지}" 라고요?',
        botName: '상대', showNames: false,
        meColor: '', otherColor: '', bg: '', fontSize: 14,
      },
      fields: [
        { key: 'messages', label: '처음 보이는 대화', type: 'textarea', rows: 5, hint: '한 줄에 하나씩 "이름: 내용". "나:"로 쓰면 내 메시지' },
        { key: 'autoReply', label: '자동 답장', type: 'textarea', rows: 3, hint: '메시지를 보내면 이 중 하나로 답장해요. {메시지} = 보낸 내용. 비우면 답장 없음' },
        { key: 'botName', label: '답장하는 사람 이름', type: 'text' },
        { key: 'showNames', label: '상대 이름 표시', type: 'checkbox' },
        SIZE('fontSize', '글자 크기', 10, 28),
        COLOR('meColor', '내 말풍선 색', 'primary'),
        COLOR('otherColor', '상대 말풍선 색', '#eeeef2'),
        COLOR('bg', '배경색'),
      ],
    },

    chatInput: {
      label: '메시지 입력창', icon: '⌨', group: '메시지', w: 'full', h: 60, dock: 'bottom',
      props: { placeholder: '메시지를 입력하세요', buttonText: '전송', bg: '', buttonColor: '' },
      fields: [
        { key: 'placeholder', label: '안내 문구', type: 'text' },
        { key: 'buttonText', label: '버튼 글자', type: 'text' },
        COLOR('buttonColor', '버튼 색', 'primary'),
        COLOR('bg', '배경색', '#ffffff'),
      ],
      note: '같은 화면의 메시지 창으로 메시지를 보내요.',
    },

    list: {
      label: '목록', icon: '☰', group: '메시지', w: 'full', h: 280,
      props: { items: '첫 번째 항목|설명\n두 번째 항목|설명\n세 번째 항목|설명', avatars: false, chevron: true, target: '', bg: '', color: '' },
      fields: [
        { key: 'items', label: '항목', type: 'textarea', rows: 5, hint: '한 줄에 하나씩. "제목|부제목" 형식도 돼요' },
        { key: 'avatars', label: '프로필 동그라미 표시', type: 'checkbox' },
        { key: 'chevron', label: '오른쪽 화살표 표시', type: 'checkbox' },
        { key: 'target', label: '누르면 이동할 화면', type: 'screen' },
        COLOR('color', '글자색', 'text'),
        COLOR('bg', '배경색'),
      ],
    },

    text: {
      label: '텍스트', icon: 'T', group: '기본', w: 280, h: 40,
      props: { text: '텍스트를 입력하세요', size: 16, bold: false, align: 'left', color: '' },
      fields: [
        { key: 'text', label: '내용', type: 'textarea', rows: 3 },
        SIZE('size', '글자 크기', 8, 96),
        { key: 'bold', label: '굵게', type: 'checkbox' },
        { key: 'align', label: '정렬', type: 'select', options: [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] },
        COLOR('color', '글자색', 'text'),
      ],
    },

    button: {
      label: '버튼', icon: '⬭', group: '기본', w: 200, h: 48,
      props: { label: '버튼', variant: 'filled', action: 'alert', target: '', message: '버튼을 눌렀어요!', url: '', size: 16, radius: 12, bg: '', color: '' },
      fields: [
        { key: 'label', label: '글자', type: 'text' },
        { key: 'variant', label: '모양', type: 'select', options: [['filled', '채움'], ['outline', '테두리'], ['text', '글자만']] },
        {
          key: 'action', label: '누르면', type: 'select',
          options: [['none', '아무것도 안 함'], ['go', '다른 화면으로 이동'], ['back', '뒤로 가기'], ['alert', '알림 띄우기'], ['send', '메시지 보내기'], ['link', '웹 링크 열기']],
        },
        { key: 'target', label: '이동할 화면', type: 'screen', show: (p) => p.action === 'go' },
        { key: 'message', label: '내용', type: 'text', show: (p) => p.action === 'alert' || p.action === 'send' },
        { key: 'url', label: '링크 주소', type: 'text', show: (p) => p.action === 'link' },
        SIZE('size', '글자 크기', 8, 48),
        SIZE('radius', '모서리 둥글기', 0, 100),
        COLOR('bg', '버튼 색', 'primary'),
        COLOR('color', '글자색'),
      ],
    },

    image: {
      label: '이미지', icon: '🖼', group: '기본', w: 320, h: 180,
      props: { src: '', fit: 'cover', radius: 12 },
      fields: [
        { key: 'src', label: '이미지', type: 'image' },
        { key: 'fit', label: '맞춤', type: 'select', options: [['cover', '꽉 채우기'], ['contain', '전체 보이기']] },
        SIZE('radius', '모서리 둥글기', 0, 200),
      ],
    },

    card: {
      label: '카드', icon: '▤', group: '기본', w: 320, h: 110,
      props: { title: '카드 제목', body: '카드 내용을 입력하세요.', radius: 16, shadow: true, target: '', bg: '' },
      fields: [
        { key: 'title', label: '제목', type: 'text' },
        { key: 'body', label: '내용', type: 'textarea', rows: 3 },
        { key: 'target', label: '누르면 이동할 화면', type: 'screen' },
        SIZE('radius', '모서리 둥글기', 0, 60),
        { key: 'shadow', label: '그림자', type: 'checkbox' },
        COLOR('bg', '배경색', '#ffffff'),
      ],
    },

    avatar: {
      label: '프로필', icon: '◉', group: '기본', w: 80, h: 80,
      props: { text: '나', src: '', bg: '', color: '' },
      fields: [
        { key: 'text', label: '글자 (사진이 없을 때)', type: 'text' },
        { key: 'src', label: '사진', type: 'image' },
        COLOR('bg', '배경색', 'primary'),
        COLOR('color', '글자색', '#ffffff'),
      ],
    },

    input: {
      label: '입력 칸', icon: '▭', group: '입력', w: 312, h: 72,
      props: { label: '이름', placeholder: '입력하세요', inputType: 'text', radius: 10 },
      fields: [
        { key: 'label', label: '제목', type: 'text' },
        { key: 'placeholder', label: '안내 문구', type: 'text' },
        { key: 'inputType', label: '종류', type: 'select', options: [['text', '일반'], ['password', '비밀번호'], ['email', '이메일'], ['number', '숫자']] },
        SIZE('radius', '모서리 둥글기', 0, 40),
      ],
    },

    toggle: {
      label: '스위치', icon: '◐', group: '입력', w: 'full', h: 52,
      props: { label: '알림 받기', on: true, color: '' },
      fields: [
        { key: 'label', label: '글자', type: 'text' },
        { key: 'on', label: '처음에 켜짐', type: 'checkbox' },
        COLOR('color', '켜졌을 때 색', 'primary'),
      ],
    },
  };
})();
