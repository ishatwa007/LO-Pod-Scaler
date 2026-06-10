export type Program   = 'Academy' | 'DSML' | 'DevOps';
export type ViewMode  = '7d' | 'mom';

export interface DayCount   { date: string;  count: number }
export interface MonthCount { month: string; count: number }
export interface BatchCount { batch: string; count: number }

export interface MetricRow {
  id:         string;
  label:      string;
  total:      number;
  days:       DayCount[];
  months:     MonthCount[];
  batches?:   BatchCount[];
  noDaily?:   boolean;
  isStatic?:  boolean;
  group?:     string;
  drillable?: boolean;
}

export interface ProgramMetrics { rows: MetricRow[]; learners: number }

export interface AllMetrics {
  academy: ProgramMetrics;
  dsml:    ProgramMetrics;
  devops:  ProgramMetrics;
  days:    string[];
  months:  string[];
}

export interface DrillUser {
  userId?:      string;
  name?:        string;
  email:        string;
  batch:        string;
  program?:     string;
  contestName?: string;
  contestType?: string;
  status?:      string;
  attempted?:   string;
  passed?:      string;
  miScore?:     string;
  miStatus?:    string;
  startDate?:   string;
  expireDate?:  string;
  dsa?:         string;
  sql?:         string;
  certDate?:    string;
}

export interface DrillResponse {
  users:  DrillUser[];
  total:  number;
  source: 'live_contests' | 'sheet4';
}

export type { LOAllMetrics, LOProgramMetrics, LOMetricRow } from '@/lib/lo-metrics';

export interface NoteRecord {
  timestamp:  string;
  program:    string;
  metricId:   string;
  noteDate:   string;
  author:     string;
  note:       string;
}
