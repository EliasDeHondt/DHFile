export type AppTheme = 'system' | 'dark' | 'light';
export type Language = 'nl' | 'en';
export type ViewMode = 'details' | 'grid';
export type IconSize = 'small' | 'medium' | 'large';
export type SortKey = 'name' | 'mtime' | 'type' | 'size';
export type Startup = 'home' | 'pc' | 'last' | 'custom';

export interface Entry {
  name: string;
  path: string;
  dir: boolean;
  size: number;
  mtime: number;
  ctime: number;
  ext: string;
  hidden: boolean;
  link: boolean;
  readonly: boolean;
  /** Only filled in for search results: the folder the entry lives in. */
  parent?: string;
}

export interface Listing { path: string; entries: Entry[]; error?: string; code?: string; }

export type DriveType = 'fixed' | 'removable' | 'network' | 'cd' | 'ram' | 'unknown';
export interface Drive { letter: string; path: string; label: string; type: DriveType; total: number; free: number; }

export interface Place { id: string; path: string; }

export interface Settings {
  theme: AppTheme;
  language: Language;
  mica: boolean;
  showHidden: boolean;
  showExtensions: boolean;
  foldersFirst: boolean;
  confirmDelete: boolean;
  view: ViewMode;
  iconSize: IconSize;
  preview: boolean;
  sortKey: SortKey;
  sortDir: number;
  startup: Startup;
  startupPath: string;
  lastTabs: string[];
  pinned: string[];
  pinsSeeded: boolean;
  sidebarWidth: number;
  defaultFolderApp: boolean;
  autoLockMinutes: number;
}

export interface LockStatus { hasPin: boolean; length: number | null; retryAfter: number; unlocked: boolean; }
export interface UnlockResult { ok: boolean; retryAfter: number; }

export interface AppInfo {
  version: string;
  platform: string;
  osBuild: number;
  packaged: boolean;
  initialPath: string | null;
  settingsPath: string;
  home: string;
  user: string;
  places: Place[];
  terminal: 'dhterminal' | 'wt' | 'powershell';
  vscode: boolean;
}

export type Conflict = 'ask' | 'replace' | 'skip' | 'keep';
export interface TransferRequest { sources: string[]; dest: string; mode: 'copy' | 'move'; conflict: Conflict; }
export interface TransferResult { ok: boolean; conflicts?: string[]; created: string[]; failed: { path: string; error: string }[]; }

export interface OpResult { ok: boolean; path?: string; error?: string; }

export interface Properties {
  path: string;
  name: string;
  dir: boolean;
  size: number;
  files: number;
  folders: number;
  created: number;
  modified: number;
  accessed: number;
  readonly: boolean;
  hidden: boolean;
  done: boolean;
  target?: string;
}

export interface Preview { kind: 'text' | 'none'; text?: string; truncated?: boolean; }

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'en',
  mica: false,
  showHidden: false,
  showExtensions: true,
  foldersFirst: true,
  confirmDelete: false,
  view: 'details',
  iconSize: 'medium',
  preview: false,
  sortKey: 'name',
  sortDir: 1,
  startup: 'home',
  startupPath: '',
  lastTabs: [],
  pinned: [],
  pinsSeeded: false,
  sidebarWidth: 236,
  defaultFolderApp: false,
  autoLockMinutes: 30,
};
