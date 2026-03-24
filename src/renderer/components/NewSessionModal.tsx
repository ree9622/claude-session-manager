import React, { useState, useEffect } from 'react';
import { t } from '../i18n';
import { SessionInfo } from '../types';

interface NewSessionModalProps {
  onSubmit: (cwd: string, name: string) => void;
  onClose: () => void;
  sessions: SessionInfo[];
}

export function NewSessionModal({ onSubmit, onClose, sessions }: NewSessionModalProps) {
  const [cwd, setCwd] = useState('');
  const [name, setName] = useState('');

  // Extract unique project directories from sessions
  const projectDirs = React.useMemo(() => {
    const dirs = new Map<string, string>();
    for (const s of sessions) {
      if (s.cwd && !dirs.has(s.cwd)) {
        dirs.set(s.cwd, s.projectName);
      }
    }
    return Array.from(dirs.entries()).map(([path, label]) => ({ path, label }));
  }, [sessions]);

  useEffect(() => {
    if (projectDirs.length > 0 && !cwd) {
      setCwd(projectDirs[0].path);
    }
  }, [projectDirs]);

  const handleBrowse = async () => {
    const selected = await window.api.openDirectoryDialog();
    if (selected) setCwd(selected);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{t('modal.newSession')}</h2>

        <div className="form-group">
          <label>{t('modal.workDir')}</label>
          <select value={cwd} onChange={e => setCwd(e.target.value)}>
            {projectDirs.map(d => (
              <option key={d.path} value={d.path}>{d.label} — {d.path}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>{t('modal.customPath')}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={cwd}
              onChange={e => setCwd(e.target.value)}
              style={{ flex: 1 }}
              readOnly
            />
            <button className="btn" onClick={handleBrowse}>{t('modal.browse')}</button>
          </div>
        </div>

        <div className="form-group">
          <label>{t('modal.sessionName')}</label>
          <input type="text" placeholder={t('modal.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>{t('modal.cancel')}</button>
          <button className="btn btn-primary" onClick={() => onSubmit(cwd, name)} disabled={!cwd}>{t('modal.start')}</button>
        </div>
      </div>
    </div>
  );
}
