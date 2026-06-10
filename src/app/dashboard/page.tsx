'use client';
import { useState, useCallback, useEffect } from 'react';
import { Shell }        from '@/components/Shell';
import { ProgramPanel } from '@/components/ProgramPanel';
import { LOPanel }      from '@/components/LOPanel';
import { AuthModal }    from '@/components/AuthModal';
import { CortexPanel }          from '@/components/CortexPanel';
import { ContentHealthPanel }  from '@/components/ContentHealthPanel';
import { useAPI }       from '@/hooks/useAPI';
import { visiblePrograms, isReadOnly } from '@/lib/auth-client';
import type { AllMetrics, Program } from '@/types';
import type { LOAllMetrics } from '@/lib/lo-metrics';
import type { NoteRecord } from '@/types';

type View    = '7d' | 'mom';
type DashTab = 'cert' | 'lo' | 'cortex' | 'content_health';

const ALL_CERT_PROGRAMS: Program[] = ['Academy', 'DSML', 'DevOps'];
const ALL_LO_PROGRAMS   = ['Academy', 'DSML', 'DevOps', 'AIML'] as const;
type LOProgram = typeof ALL_LO_PROGRAMS[number];

const CERT_MODULES: Record<string, string[]> = {
  Academy: ['All', 'DSA', 'SQL'],
  DSML:    ['All', 'DSML SQL', 'EDA'],
  DevOps:  ['All', 'Linux', 'Tools', 'AWS'],
};
const LO_GROUPS = ['All','NPS & Curriculum','I2H & I2R','I2R by Module','Content T+7','Lecture D-1','Cue Cards','PSP','Tickets'] as const;
const LO_GROUP_IDS: Record<string, string> = {
  'NPS & Curriculum': 'nps', 'I2H & I2R': 'hiring',
  'I2R by Module': 'i2r_module',
  'Content T+7': 'content_t7', 'Lecture D-1': 'lecture_d1',
  'Cue Cards': 'cue_card', 'PSP': 'psp', 'Tickets': 'tickets',
};

interface AuthSession { username: string; role: string; displayName: string }

export default function Page() {
  // Auth
  const [session,       setSession]       = useState<AuthSession | null>(null);
  const [authChecked,   setAuthChecked]   = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lo_session');
      if (raw) { const s = JSON.parse(raw); if (s?.username) setSession(s); }
    } catch { /* ignore */ }
    setAuthChecked(true);
  }, []);

  const handleLogin = useCallback((username: string, role: string, displayName: string) => {
    const s = { username, role, displayName };
    setSession(s);
    try { localStorage.setItem('lo_session', JSON.stringify(s)); } catch { /* ignore */ }
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    try { localStorage.removeItem('lo_session'); } catch { /* ignore */ }
  }, []);

  // Tabs & filters
  const [dashTab,       setDashTab]       = useState<DashTab>('cert');
  const [certProgram,   setCertProgram]   = useState<Program>('Academy');
  const [loProgram,     setLoProgram]     = useState<LOProgram>('Academy');
  const [cortexProgram, setCortexProgram] = useState<'Academy'|'DSML'|'DevOps'>('Academy');
  const [view,          setView]          = useState<View>('7d');
  const [certModule,    setCertModule]    = useState('All');
  const [loGroup,       setLoGroup]       = useState('All');
  const [search,        setSearch]        = useState('');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [loDateFrom,    setLoDateFrom]    = useState('');
  const [loDateTo,      setLoDateTo]      = useState('');
  const [refreshKey,    setRefreshKey]    = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(new Date());
  const [notes,         setNotes]         = useState<Record<string, NoteRecord>>({});

  const certApiUrl = `/api/cert/metrics${dateFrom && dateTo ? `?from=${dateFrom}&to=${dateTo}` : ''}`;
  const certAPI = useAPI<AllMetrics>(certApiUrl);
  const loAPI   = useAPI<LOAllMetrics>('/api/lo/metrics');

  useEffect(() => {
    fetch('/api/notes').then(r => r.json()).then(d => { if (d.notes) setNotes(d.notes); }).catch(() => {});
  }, []);

  useEffect(() => { setSearch(''); }, [certProgram, loProgram, dashTab]);
  useEffect(() => { setCertModule('All'); }, [certProgram]);
  useEffect(() => { certAPI.refetch(); }, [certApiUrl]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    setLastRefreshed(new Date());
    certAPI.refetch();
    loAPI.refetch();
  }, [certAPI, loAPI]);

  const handleNotesSaved = useCallback((key: string, record: NoteRecord) => {
    setNotes(prev => ({ ...prev, [key]: record }));
  }, []);

  // Role-gated programs
  const role          = session?.role ?? 'admin';
  const allowedProgs  = session ? visiblePrograms(role as Parameters<typeof visiblePrograms>[0]) : [];
  const readOnly      = session ? isReadOnly(role as Parameters<typeof isReadOnly>[0]) : false;
  const author        = session?.displayName ?? session?.username ?? 'Unknown';

  const certPrograms  = ALL_CERT_PROGRAMS.filter(p => allowedProgs.includes(p));
  const loPrograms    = ALL_LO_PROGRAMS.filter(p => allowedProgs.includes(p));

  // Auto-select first allowed program
  useEffect(() => {
    if (certPrograms.length && !certPrograms.includes(certProgram)) setCertProgram(certPrograms[0]);
  }, [certPrograms, certProgram]);
  useEffect(() => {
    if (loPrograms.length && !loPrograms.includes(loProgram)) setLoProgram(loPrograms[0] as LOProgram);
  }, [loPrograms, loProgram]);

  const certProgramData = certAPI.data?.[certProgram.toLowerCase() as 'academy' | 'dsml' | 'devops'];
  const loProgramData   = loAPI.data?.[loProgram.toLowerCase() as 'academy' | 'dsml' | 'devops' | 'aiml'];

  if (!authChecked) return null;

  if (!session) return <AuthModal onLogin={handleLogin} />;

  return (
    <Shell lastRefreshed={lastRefreshed} onRefresh={handleRefresh} onLogout={handleLogout} user={author}>
      <div className="flex" style={{ minHeight: 'calc(100vh - 88px)' }}>

        {/* ── Left sidebar ── */}
        <div className="shrink-0 border-r" style={{ width: 164, borderColor: 'var(--border)', background: 'var(--surface)' }}>

          {/* View toggle */}
          <div className="border-b" style={{ borderColor: 'var(--border)' }}>
            {(['7d','mom'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="w-full text-left px-4 py-2.5 text-xs border-b"
                style={{ borderColor: 'var(--border2)', background: view === v ? 'rgba(255,255,255,0.06)' : 'transparent', color: view === v ? 'var(--text)' : 'var(--muted)', fontWeight: view === v ? 600 : 400 }}>
                {v === '7d' ? '7 Days' : 'Month on Month'}
              </button>
            ))}
          </div>

          {/* Tab */}
          <div className="border-b pt-1" style={{ borderColor: 'var(--border)' }}>
            <p className="px-4 py-1.5 text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)', letterSpacing: '0.1em' }}>View</p>
            {(['cert','lo','cortex','content_health'] as DashTab[]).map(t => (
              <button key={t} onClick={() => setDashTab(t)}
                className="w-full text-left px-4 py-2.5 text-sm border-l-2 transition-colors"
                style={{ borderColor: dashTab === t ? 'var(--text)' : 'transparent', background: dashTab === t ? 'rgba(255,255,255,0.05)' : 'transparent', color: dashTab === t ? 'var(--text)' : 'var(--muted)', fontWeight: dashTab === t ? 600 : 400 }}>
                {t === 'cert' ? 'Certification' : t === 'lo' ? 'LO Ops' : t === 'cortex' ? 'Cortex Tracking' : 'Content Health'}
              </button>
            ))}
          </div>

          {/* Programs */}
          <div className="pt-1">
            <p className="px-4 py-1.5 text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)', letterSpacing: '0.1em' }}>Program</p>
            {dashTab !== 'content_health' && (
              (dashTab === 'cert' ? certPrograms : dashTab === 'lo' ? loPrograms : ['Academy','DSML','DevOps']).map(p => (
                <button key={p}
                  onClick={() => dashTab === 'cert' ? setCertProgram(p as Program) : dashTab === 'lo' ? setLoProgram(p as LOProgram) : setCortexProgram(p as 'Academy'|'DSML'|'DevOps')}
                  className="w-full text-left px-4 py-2.5 text-sm border-l-2 transition-colors"
                  style={{
                    borderColor: (dashTab === 'cert' ? certProgram : dashTab === 'lo' ? loProgram : cortexProgram) === p ? 'var(--text)' : 'transparent',
                    background:  (dashTab === 'cert' ? certProgram : dashTab === 'lo' ? loProgram : cortexProgram) === p ? 'rgba(255,255,255,0.05)' : 'transparent',
                    color:       (dashTab === 'cert' ? certProgram : dashTab === 'lo' ? loProgram : cortexProgram) === p ? 'var(--text)' : 'var(--muted)',
                    fontWeight:  (dashTab === 'cert' ? certProgram : dashTab === 'lo' ? loProgram : cortexProgram) === p ? 600 : 400,
                  }}>
                  {p}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

            {dashTab === 'cert' && CERT_MODULES[certProgram]?.map(m => (
              <button key={m} onClick={() => setCertModule(m)}
                className="text-xs px-3 py-1.5 border"
                style={{ borderColor: certModule === m ? 'var(--text)' : 'var(--border)', background: certModule === m ? 'var(--text)' : 'transparent', color: certModule === m ? 'var(--bg)' : 'var(--muted)' }}>
                {m}
              </button>
            ))}

            {dashTab === 'lo' && LO_GROUPS.map(g => (
              <button key={g} onClick={() => setLoGroup(g)}
                className="text-xs px-3 py-1.5 border"
                style={{ borderColor: loGroup === g ? 'var(--text)' : 'var(--border)', background: loGroup === g ? 'var(--text)' : 'transparent', color: loGroup === g ? 'var(--bg)' : 'var(--muted)' }}>
                {g}
              </button>
            ))}

            {/* Date range filter — LO tab */}
            {dashTab === 'content_health' && (
              <ContentHealthPanel />
            )}

            {dashTab === 'cortex' && (
              <CortexPanel
                program={cortexProgram}
                author={author}
                readOnly={readOnly}
                notes={notes}
                onNotesSaved={handleNotesSaved}
              />
            )}

            {dashTab === 'lo' && (
              <>
                <div style={{ width:1, height:18, background:'var(--border)' }} />
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color:'var(--muted)' }}>From</span>
                  <input type="date" value={loDateFrom} onChange={e=>{setLoDateFrom(e.target.value);if(!e.target.value)setLoDateTo('');}}
                    className="text-xs border px-2 py-1 outline-none"
                    style={{ background:'var(--input-bg)', borderColor:'var(--border)', color:'var(--text)' }} />
                  <span className="text-xs" style={{ color:'var(--muted)' }}>To</span>
                  <input type="date" value={loDateTo} onChange={e=>setLoDateTo(e.target.value)}
                    className="text-xs border px-2 py-1 outline-none"
                    style={{ background:'var(--input-bg)', borderColor:'var(--border)', color:'var(--text)' }} />
                  {(loDateFrom||loDateTo)&&<button onClick={()=>{setLoDateFrom('');setLoDateTo('');}} className="text-xs px-2 py-1 border" style={{borderColor:'var(--border)',color:'var(--muted)',background:'none'}}>Clear</button>}
                </div>
              </>
            )}
            {/* Date range filter — cert tab only */}
            {dashTab === 'cert' && (
              <>
                <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>From</span>
                  <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); if (!e.target.value) setDateTo(''); }}
                    className="text-xs border px-2 py-1 outline-none"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>To</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="text-xs border px-2 py-1 outline-none"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  {(dateFrom || dateTo) && (
                    <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                      className="text-xs px-2 py-1 border"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'none' }}>
                      Clear
                    </button>
                  )}
                </div>
              </>
            )}
            <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

            <div className="flex items-center gap-2 border px-2.5 py-1.5 flex-1 max-w-xs"
              style={{ borderColor: 'var(--border)', background: 'var(--input-bg)' }}>
              <span style={{ color: 'var(--muted2)', fontSize: 12 }}>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search metrics…"
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: 'var(--text)' }} />
              {search && <button onClick={() => setSearch('')} style={{ color: 'var(--muted2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>✕</button>}
            </div>

            <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
              {view === '7d' ? 'Daily counts' : 'Monthly counts'}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 p-4">

            {dashTab === 'cert' && (
              <>
                {certAPI.loading && <LoadingSpinner />}
                {certAPI.error   && <ErrorCard msg={certAPI.error} onRetry={certAPI.refetch} />}
                {certAPI.data && !certAPI.loading && certProgramData && (
                  <div key={`cert-${refreshKey}`}>
                    <ProgramPanel
                      program={certProgram} rows={certProgramData.rows}
                      days={certAPI.data.days} months={certAPI.data.months}
                      view={view} learners={certProgramData.learners}
                      moduleFilter={certModule} search={search}
                      author={author} readOnly={readOnly}
                      notes={notes} onNotesSaved={handleNotesSaved}
                    />
                  </div>
                )}
              </>
            )}

            {dashTab === 'lo' && (
              <>
                {loAPI.loading && <LoadingSpinner />}
                {loAPI.error   && <ErrorCard msg={loAPI.error} onRetry={loAPI.refetch} />}
                {loAPI.data && !loAPI.loading && loProgramData && (
                  <div key={`lo-${refreshKey}`}>
                    <LOPanel
                      program={loProgram} rows={loProgramData.rows}
                      days={loAPI.data.days} months={loAPI.data.months}
                      view={view}
                      groupFilter={LO_GROUP_IDS[loGroup] || 'All'}
                      search={search}
                      author={author} readOnly={readOnly}
                      notes={notes} onNotesSaved={handleNotesSaved}
                      dateFrom={loDateFrom} dateTo={loDateTo}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-8 animate-bounce"
            style={{ background: 'rgba(255,255,255,0.2)', animationDelay: `${i*0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="border p-4" style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
      <p className="text-sm" style={{ color: 'var(--bad)' }}>{msg}</p>
      <button onClick={onRetry} className="mt-2 text-xs px-3 py-1 border"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Retry</button>
    </div>
  );
}
