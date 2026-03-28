export type Lang = 'en' | 'ko';

const translations = {
  // App
  'app.title': { en: 'Claude Session Manager', ko: '클로드 세션 매니저' },

  // Sidebar
  'sidebar.search': { en: 'Search sessions...', ko: '세션 검색...' },
  'sidebar.newSession': { en: '+ New Session', ko: '+ 새 세션' },
  'sidebar.openSelected': { en: 'Open selected', ko: '선택 열기' },
  'sidebar.sortProject': { en: 'By project', ko: '경로별' },
  'sidebar.sortTime': { en: 'By time', ko: '시간별' },
  'sidebar.cleanup': { en: 'Cleanup', ko: '정리' },
  'sidebar.cleanupResult': { en: '{n} sessions cleaned (30+ days)', ko: '{n}개 세션 정리됨 (30일 이상)' },
  'sidebar.loading': { en: 'Loading...', ko: '불러오는 중...' },
  'sidebar.noSessions': { en: 'No sessions', ko: '세션이 없습니다' },
  'sidebar.refresh': { en: 'Refresh sessions', ko: '세션 새로고침' },
  'sidebar.collapse': { en: 'Collapse sidebar', ko: '사이드바 접기' },
  'sidebar.expand': { en: 'Expand sidebar', ko: '사이드바 펼치기' },

  // Session item
  'session.open': { en: 'Open', ko: '열기' },
  'session.quickOpen': { en: 'Quick open', ko: '바로 열기' },
  'session.generateName': { en: 'Name', ko: '이름 생성' },
  'session.delete': { en: 'Delete', ko: '삭제' },
  'session.deleteConfirm': { en: 'Delete this session?', ko: '이 세션을 삭제할까요?' },
  'session.messages': { en: '{n}+', ko: '{n}개+' },
  'session.noData': { en: '(no session data)', ko: '(세션 데이터 없음)' },
  'session.expand': { en: 'Details', ko: '상세' },
  'session.favorite': { en: 'Favorite', ko: '즐겨찾기' },
  'session.hide': { en: 'Hide', ko: '숨기기' },
  'sidebar.showHidden': { en: 'Hidden', ko: '숨긴 항목' },
  'sidebar.favorites': { en: 'Favorites', ko: '즐겨찾기' },

  // Time
  'time.now': { en: 'Just now', ko: '방금 전' },
  'time.minutes': { en: '{n}m ago', ko: '{n}분 전' },
  'time.hours': { en: '{n}h ago', ko: '{n}시간 전' },
  'time.days': { en: '{n}d ago', ko: '{n}일 전' },
  'time.months': { en: '{n}mo ago', ko: '{n}개월 전' },
  'time.today': { en: 'Today', ko: '오늘' },
  'time.yesterday': { en: 'Yesterday', ko: '어제' },
  'time.thisWeek': { en: 'This week', ko: '이번 주' },
  'time.thisMonth': { en: 'This month', ko: '이번 달' },
  'time.older': { en: 'Older', ko: '오래 전' },

  // Toolbar
  'view.thumbnail': { en: 'Thumbnail', ko: '썸네일' },
  'view.grid': { en: 'Grid', ko: '그리드' },
  'view.focus': { en: 'Focus', ko: '포커스' },
  'toolbar.active': { en: '{n} terminals active', ko: '{n}개 터미널 활성' },
  'toolbar.noTerminals': { en: 'No terminals', ko: '터미널 없음' },
  'toolbar.closeAll': { en: 'Close all', ko: '전체 닫기' },
  'grid.auto': { en: 'Auto', ko: '자동' },
  'grid.columns': { en: 'col', ko: '열' },
  'toolbar.closeAllConfirm': { en: 'Close all terminals?', ko: '모든 터미널을 닫을까요?' },
  'toolbar.nameAll': { en: 'Name all', ko: '이름 생성' },

  // Terminal grid
  'terminal.empty': { en: 'No active terminals', ko: '활성 터미널이 없습니다' },
  'terminal.emptyHint': { en: 'Click ▶ on a session or press "+ New Session"', ko: '▶ 버튼 또는 "+ 새 세션"으로 시작하세요' },
  'terminal.close': { en: 'Close', ko: '종료' },
  'terminal.exited': { en: '[Session ended]', ko: '[세션 종료]' },

  // New session modal
  'modal.newSession': { en: 'New Claude Session', ko: '새 Claude 세션' },
  'modal.workDir': { en: 'Working directory', ko: '작업 디렉토리' },
  'modal.customPath': { en: 'Custom path', ko: '경로 직접 선택' },
  'modal.browse': { en: 'Browse...', ko: '찾아보기...' },
  'modal.sessionName': { en: 'Session name (optional)', ko: '세션 이름 (선택)' },
  'modal.namePlaceholder': { en: 'e.g. Fix payment bug', ko: '예: 결제 버그 수정' },
  'modal.cancel': { en: 'Cancel', ko: '취소' },
  'modal.start': { en: 'Start session', ko: '세션 시작' },

  // Tray
  'tray.showHide': { en: 'Show / Hide', ko: '보이기 / 숨기기' },
  'tray.startOnLogin': { en: 'Start on login', ko: '로그인 시 시작' },
  'tray.quit': { en: 'Quit', ko: '종료' },

  // Updater
  'updater.available': { en: 'Update v{version} available — downloading...', ko: 'v{version} 업데이트 발견 — 다운로드 중...' },
  'updater.downloading': { en: 'Downloading update...', ko: '업데이트 다운로드 중...' },
  'updater.ready': { en: 'Update v{version} ready.', ko: 'v{version} 업데이트 준비 완료.' },
  'updater.restartBtn': { en: 'Restart Now', ko: '지금 재시작' },

  // Detail
  'detail.path': { en: 'Path', ko: '경로' },
  'detail.messages': { en: 'Messages', ko: '메시지' },

  // Naming
  'naming.title': { en: 'Generating session names...', ko: '세션 이름 생성 중...' },
  'naming.titleQuit': { en: 'Naming sessions before closing...', ko: '종료 전 세션 이름 생성 중...' },

  // Settings
  'settings.title': { en: 'Settings', ko: '설정' },
  'settings.fontSize': { en: 'Font size', ko: '폰트 크기' },
  'settings.scrollback': { en: 'Scrollback lines', ko: '스크롤백 줄 수' },
  'settings.notifications': { en: 'Task completion notifications', ko: '작업 완료 알림' },
  'settings.sidebarWidth': { en: 'Sidebar width', ko: '사이드바 너비' },
  'settings.reset': { en: 'Reset to defaults', ko: '기본값으로 초기화' },

  // Pin
  'session.pin': { en: 'Pin', ko: '고정' },
  'session.unpin': { en: 'Unpin', ko: '고정 해제' },
  'session.pinned': { en: 'Pinned', ko: '고정됨' },
} as const;

export type TranslationKey = keyof typeof translations;

let currentLang: Lang = (typeof localStorage !== 'undefined' && localStorage.getItem('lang') as Lang) || 'ko';

export function setLang(lang: Lang) {
  currentLang = lang;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lang', lang);
  }
}

export function getLang(): Lang {
  return currentLang;
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const entry = translations[key];
  if (!entry) return key;
  let text = entry[currentLang] || entry['en'];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
