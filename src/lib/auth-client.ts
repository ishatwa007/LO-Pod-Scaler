// Client-safe auth helpers (no passwords, no server logic)
export type Role = 'academy' | 'dsml' | 'aiml' | 'devops' | 'admin' | 'scaler';

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
