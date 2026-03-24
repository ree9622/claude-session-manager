import React from 'react';
import { ViewMode } from '../types';

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeCount: number;
}

const viewLabels: Record<ViewMode, string> = {
  thumbnail: '썸네일',
  grid: '그리드',
  focus: '포커스',
};

export function Toolbar({ viewMode, onViewModeChange, activeCount }: ToolbarProps) {
  return (
    <div className="toolbar">
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
      <span className="active-count">
        {activeCount > 0 ? `${activeCount}개 터미널 활성` : '터미널 없음'}
      </span>
    </div>
  );
}
