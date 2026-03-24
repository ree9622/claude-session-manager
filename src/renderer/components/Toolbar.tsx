import React from 'react';
import { ViewMode } from '../types';

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeCount: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const viewLabels: Record<ViewMode, string> = {
  thumbnail: '썸네일',
  grid: '그리드',
  focus: '포커스',
};

export function Toolbar({ viewMode, onViewModeChange, activeCount, sidebarCollapsed, onToggleSidebar }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sidebarCollapsed && (
          <button className="btn-icon" onClick={onToggleSidebar} title="사이드바 펼치기">☰</button>
        )}
        <div className="view-switcher">
          {(['thumbnail', 'grid', 'focus'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              className={viewMode === mode ? 'active' : ''}
              onClick={() => onViewModeChange(mode)}
            >
              {viewLabels[mode]}
            </button>
          ))}
        </div>
      </div>
      <span className="active-count">
        {activeCount > 0 ? `${activeCount}개 터미널 활성` : '터미널 없음'}
      </span>
    </div>
  );
}
