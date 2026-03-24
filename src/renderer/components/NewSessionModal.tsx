import React, { useState } from 'react';

interface NewSessionModalProps {
  onSubmit: (cwd: string, name: string) => void;
  onClose: () => void;
}

const PRESET_DIRS = [
  { label: 'Desktop', path: 'C:\\Users\\ko\\Desktop' },
  { label: 'ClassUp', path: 'C:\\Users\\ko\\Documents\\GitHub\\classup-front-back' },
  { label: 'LetMeUp', path: 'C:\\Users\\ko\\Documents\\GitHub\\letmeup-front-back' },
  { label: 'StockUp', path: 'C:\\Users\\ko\\Documents\\GitHub\\stockup' },
];

export function NewSessionModal({ onSubmit, onClose }: NewSessionModalProps) {
  const [cwd, setCwd] = useState(PRESET_DIRS[0].path);
  const [name, setName] = useState('');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>새 Claude 세션</h2>

        <div className="form-group">
          <label>작업 디렉토리</label>
          <select value={cwd} onChange={e => setCwd(e.target.value)}>
            {PRESET_DIRS.map(d => (
              <option key={d.path} value={d.path}>{d.label} — {d.path}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>커스텀 경로 (선택)</label>
          <input
            type="text"
            placeholder="C:\path\to\project"
            value={cwd}
            onChange={e => setCwd(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>세션 이름 (선택)</label>
          <input
            type="text"
            placeholder="예: ClassUp 결제 버그 수정"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={() => onSubmit(cwd, name)}>
            세션 시작
          </button>
        </div>
      </div>
    </div>
  );
}
