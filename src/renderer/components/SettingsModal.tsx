import React, { useState, useEffect } from 'react';
import { t } from '../i18n';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.api.settings.getAll().then(all => {
      setValues(all);
      setLoaded(true);
    });
  }, []);

  const update = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    window.api.settings.set(key, value);
  };

  if (!loaded) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <h2>{t('settings.title')}</h2>

        <div className="settings-group">
          <div className="settings-row">
            <label>{t('settings.fontSize')}</label>
            <div className="settings-control">
              <button className="btn btn-sm" onClick={() => update('fontSize', Math.max(8, (values.fontSize || 13) - 1))}>-</button>
              <span className="settings-value">{values.fontSize || 13}px</span>
              <button className="btn btn-sm" onClick={() => update('fontSize', Math.min(24, (values.fontSize || 13) + 1))}>+</button>
            </div>
          </div>

          <div className="settings-row">
            <label>{t('settings.scrollback')}</label>
            <div className="settings-control">
              <select
                value={values.scrollback || 5000}
                onChange={e => update('scrollback', Number(e.target.value))}
              >
                {[1000, 3000, 5000, 10000, 20000, 50000].map(n => (
                  <option key={n} value={n}>{n.toLocaleString()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-row">
            <label>{t('settings.notifications')}</label>
            <div className="settings-control">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={values.notifications !== false}
                  onChange={e => update('notifications', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-sm" onClick={() => {
            const defaults: Record<string, any> = { fontSize: 13, scrollback: 5000, sidebarWidth: 320, notifications: true };
            for (const [k, v] of Object.entries(defaults)) update(k, v);
          }}>{t('settings.reset')}</button>
          <button className="btn btn-primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
