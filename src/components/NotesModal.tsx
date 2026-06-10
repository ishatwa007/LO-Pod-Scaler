'use client';
import { useState } from 'react';
import type { NoteRecord } from '@/types';



interface Props {
  program:    string;
  metricId:   string;
  metricLabel:string;
  noteDate:   string;
  author:     string;
  existing:   NoteRecord | null;
  readOnly:   boolean;
  onClose:    () => void;
  onSaved:    (key: string, record: NoteRecord) => void;
}

export function NotesModal({ program, metricId, metricLabel, noteDate, author, existing, readOnly, onClose, onSaved }: Props) {
  const [text,    setText]    = useState(existing?.note || '');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program, metricId, noteDate, author, note: text }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      const key = `${program}:${metricId}:${noteDate}`;
      onSaved(key, { timestamp: data.timestamp, program, metricId, noteDate, author, note: text });
      setSaved(true);
      setTimeout(onClose, 800);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="border w-full max-w-md" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{program} · {noteDate}</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text)' }}>{metricLabel}</p>
          </div>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>

        {existing && (
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Last note by {existing.author} · {new Date(existing.timestamp).toLocaleString()}</p>
            <p className="text-sm" style={{ color: 'var(--text)' }}>{existing.note}</p>
          </div>
        )}

        {!readOnly && (
          <div className="p-4">
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              rows={3} placeholder="Add a note for this metric and date…"
              className="w-full border px-3 py-2 text-sm outline-none resize-none"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>}
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Signed as <strong>{author}</strong></span>
              <button onClick={handleSave} disabled={saving || !text.trim()}
                className="px-4 py-1.5 text-xs font-medium transition-opacity"
                style={{ background: saved ? 'var(--good)' : 'var(--text)', color: 'var(--bg)', opacity: (saving || !text.trim()) ? 0.5 : 1 }}>
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        )}
        {readOnly && <div className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>Read-only access — notes cannot be added.</div>}
      </div>
    </div>
  );
}

// Star indicator button for inline table use
interface StarProps {
  hasNote:  boolean;
  onClick:  (e: React.MouseEvent) => void;
  size?:    number;
}
export function NoteStar({ hasNote, onClick, size = 12 }: StarProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center transition-opacity hover:opacity-100"
      title={hasNote ? 'View/edit note' : 'Add note'}
      style={{ opacity: hasNote ? 1 : 0.25, background: 'none', border: 'none', cursor: 'pointer', padding: '1px 2px', lineHeight: 1, fontSize: size, color: hasNote ? '#f59e0b' : 'var(--muted)' }}>
      ★
    </button>
  );
}
