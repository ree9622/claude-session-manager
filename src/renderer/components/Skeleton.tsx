import React from 'react';

export function SessionListSkeleton() {
  return (
    <div className="skeleton-list">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-checkbox" />
          <div className="skeleton-content">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-text" />
          </div>
          <div className="skeleton-line skeleton-time" />
        </div>
      ))}
    </div>
  );
}

export function TerminalRestoringSkeleton({ count }: { count: number }) {
  return (
    <div className="skeleton-restoring">
      <div className="skeleton-restoring-icon">⟳</div>
      <div className="skeleton-restoring-text">
        {count > 0 ? `${count}개 터미널 복원 중...` : '로딩 중...'}
      </div>
      <div className="skeleton-restoring-dots">
        <span /><span /><span />
      </div>
    </div>
  );
}
