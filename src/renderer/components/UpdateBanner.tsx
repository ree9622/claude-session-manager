import React, { useState, useEffect } from 'react';
import { t } from '../i18n';

export function UpdateBanner() {
  const [status, setStatus] = useState<{ type: string; version?: string; percent?: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.api?.updater) return;
    const cleanup = window.api.updater.onStatus((s) => {
      setStatus(s);
      if (s.type === 'ready') setDismissed(false);
    });
    return cleanup;
  }, []);

  if (dismissed || !status) return null;
  if (status.type !== 'ready' && status.type !== 'progress' && status.type !== 'available') return null;

  return (
    <div className="update-banner">
      {status.type === 'available' && (
        <>
          <span>{t('updater.available', { version: status.version || '' })}</span>
          <span className="update-spinner" />
        </>
      )}
      {status.type === 'progress' && (
        <>
          <span>{t('updater.downloading')} {status.percent}%</span>
          <div className="update-progress">
            <div className="update-progress-bar" style={{ width: `${status.percent}%` }} />
          </div>
        </>
      )}
      {status.type === 'ready' && (
        <>
          <span>{t('updater.ready', { version: status.version || '' })}</span>
          <button className="btn btn-sm update-restart-btn" onClick={() => window.api.updater.install()}>
            {t('updater.restartBtn')}
          </button>
          <button className="update-dismiss" onClick={() => setDismissed(true)}>✕</button>
        </>
      )}
    </div>
  );
}
