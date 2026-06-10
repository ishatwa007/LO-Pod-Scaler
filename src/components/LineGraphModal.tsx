'use client';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DaySeries   { date:  string; value: number | null }
interface MonthSeries { month: string; value: number | null }

interface Props {
  label:   string;
  days30:  DaySeries[];
  months:  MonthSeries[];
  isRate:  boolean;
  onClose: () => void;
}

function fmtDay(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function LineGraphModal({ label, days30, months, isRate, onClose }: Props) {
  const [view, setView] = useState<'dod' | 'mom'>('dod');

  const dodData = days30
    .filter(d => d.value !== null)
    .map(d => ({ x: fmtDay(d.date), v: d.value as number }));

  const momData = months
    .filter(m => m.value !== null)
    .map(m => ({ x: fmtMonth(m.month), v: m.value as number }));

  const data = view === 'dod' ? dodData : momData;
  const isEmpty = data.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="border w-full max-w-2xl" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</p>
          <div className="flex items-center gap-2">
            {(['dod','mom'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="text-xs px-3 py-1.5 border transition-colors"
                style={{ borderColor: view === v ? 'var(--text)' : 'var(--border)', background: view === v ? 'var(--text)' : 'transparent', color: view === v ? 'var(--bg)' : 'var(--muted)' }}>
                {v === 'dod' ? 'Day on Day (30d)' : 'Month on Month'}
              </button>
            ))}
            <button onClick={onClose} className="ml-2 text-base" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div className="p-4" style={{ height: 280 }}>
          {isEmpty ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--muted)' }}>No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false}
                  tickFormatter={v => isRate ? `${v}%` : v.toLocaleString()} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2, fontSize: 11 }}
                  labelStyle={{ color: 'var(--text)', marginBottom: 2 }}
                  itemStyle={{ color: 'var(--text)' }}
                  formatter={(v: number) => [isRate ? `${v.toFixed(2)}%` : v.toLocaleString(), label]}
                />
                <Line type="monotone" dataKey="v" stroke="var(--text)" strokeWidth={1.5} dot={{ r: 2, fill: 'var(--text)' }} activeDot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
