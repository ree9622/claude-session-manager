import React from 'react';
import { ViewMode } from '../types';
import { t, getLang, setLang, Lang } from '../i18n';

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeCount: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onLangChange: () => void;
}

export function Toolbar({ viewMode, onViewModeChange, activeCount, sidebarCollapsed, onToggleSidebar, onLangChange }: ToolbarProps) {
  const lang = getLang();
  return (
    <div className="toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sidebarCollapsed && (
          <button className="btn-icon" onClick={onToggleSidebar} title={t('sidebar.expand')}>☰</button>
        )}
        <div className="view-switcher">
          {(['thumbnail', 'grid', 'focus'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              className={viewMode === mode ? 'active' : ''}
              onClick={() => onViewModeChange(mode)}
            >
              {t(`view.${mode}` as any)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="active-count">
          {activeCount > 0 ? t('toolbar.active', { n: activeCount }) : t('toolbar.noTerminals')}
        </span>
        <button
          className="btn-icon"
          onClick={onLangChange}
          title="Language / 언어"
          style={{ fontSize: 16 }}
        >
          {lang === 'ko' ? '🇺🇸' : '🇰🇷'}
        </button>
      </div>
    </div>
  );
}
