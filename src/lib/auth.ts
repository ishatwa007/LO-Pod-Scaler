// ── Auth ──────────────────────────────────────────────────────────────────────
// Simple credential-based auth with role-based program access.
// Session stored in localStorage; author stamped on notes.

export type Role = 'academy' | 'dsml' | 'aiml' | 'devops' | 'admin' | 'scaler';

interface UserDef { password: string; role: Role; displayName: string }

const USERS: Record<string, UserDef> = {
  academy_lo:  { password: 'Academy@2025',      role: 'academy', displayName: 'Academy LO' },
  dsml_lo:     { password: 'Dsml@2025',          role: 'dsml',    displayName: 'DSML LO' },
  aiml_lo:     { password: 'Aiml@2025',          role: 'aiml',    displayName: 'AIML LO' },
  devops_lo:   { password: 'Devops@2025',        role: 'devops',  displayName: 'DevOps LO' },
  admin:       { password: 'Admin@Scaler2025',   role: 'admin',   displayName: 'Admin' },
  scaler:      { password: 'Scaler@2025',        role: 'scaler',  displayName: 'Scaler Leadership' },
};

export interface AuthResult {
  ok:          boolean;
  username?:   string;
  role?:       Role;
  displayName?: string;
  error?:      string;
}

export function verifyCredentials(username: string, password: string): AuthResult {
  const user = USERS[username.trim().toLowerCase()];
  if (!user) return { ok: false, error: 'Unknown username' };
  if (user.password !== password) return { ok: false, error: 'Incorrect password' };
  return { ok: true, username: username.trim().toLowerCase(), role: user.role, displayName: user.displayName };
}

// Programs visible per role
export function visiblePrograms(role: Role): string[] {
  switch (role) {
    case 'academy': return ['Academy'];
    case 'dsml':    return ['DSML'];
    case 'aiml':    return ['AIML'];
    case 'devops':  return ['DevOps'];
    default:        return ['Academy', 'DSML', 'DevOps', 'AIML'];
  }
}

export function isReadOnly(role: Role): boolean {
  return role === 'scaler';
}
