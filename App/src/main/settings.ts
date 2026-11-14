import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_SETTINGS, Settings } from '../shared/types';

let cache: Settings | null = null;
let lastWritten = '';

export function settingsPath() { return join(app.getPath('userData'), 'settings.json'); }

export function sanitize(raw: any): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const def = DEFAULT_SETTINGS[key];
    const val = raw[key];
    if (val === undefined || val === null) continue;
    if (Array.isArray(def) ? Array.isArray(val) : typeof val === typeof def) (s as any)[key] = val;
  }
  s.autoLockMinutes = Math.min(480, Math.max(5, Math.round(Number(s.autoLockMinutes) || DEFAULT_SETTINGS.autoLockMinutes)));
  s.sidebarWidth = Math.min(480, Math.max(160, Math.round(Number(s.sidebarWidth) || DEFAULT_SETTINGS.sidebarWidth)));
  s.sortDir = s.sortDir < 0 ? -1 : 1;
  if (!['system', 'dark', 'light'].includes(s.theme)) s.theme = DEFAULT_SETTINGS.theme;
  if (!['nl', 'en'].includes(raw.language)) s.language = systemLanguage();
  if (!['details', 'grid'].includes(s.view)) s.view = DEFAULT_SETTINGS.view;
  if (!['small', 'medium', 'large'].includes(s.iconSize)) s.iconSize = DEFAULT_SETTINGS.iconSize;
  if (!['name', 'mtime', 'type', 'size'].includes(s.sortKey)) s.sortKey = DEFAULT_SETTINGS.sortKey;
  if (!['home', 'pc', 'last', 'custom'].includes(s.startup)) s.startup = DEFAULT_SETTINGS.startup;
  s.pinned = s.pinned.filter(p => typeof p === 'string' && p.length > 0);
  s.lastTabs = s.lastTabs.filter(p => typeof p === 'string' && p.length > 0).slice(0, 30);
  return s;
}

function systemLanguage(): Settings['language'] {
  try { return /^nl/i.test(app.getPreferredSystemLanguages()[0] ?? app.getLocale()) ? 'nl' : 'en'; } catch { return 'en'; }
}

export function getSettings(): Settings {
  if (cache) return cache;
  try { cache = sanitize(JSON.parse(readFileSync(settingsPath(), 'utf8'))); }
  catch { cache = sanitize({}); }
  return cache;
}

export function saveSettings(next: Settings): Settings {
  cache = sanitize(next);
  const file = settingsPath();
  mkdirSync(dirname(file), { recursive: true });
  lastWritten = JSON.stringify(cache, null, 2);
  writeFileSync(file + '.tmp', lastWritten, 'utf8');
  renameSync(file + '.tmp', file);
  return cache;
}

export function watchSettings(onChange: (s: Settings) => void) {
  const file = settingsPath();
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) saveSettings(getSettings());
  let timer: NodeJS.Timeout | null = null;
  try {
    watch(dirname(file), (_e, name) => {
      if (name !== 'settings.json') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const text = readFileSync(file, 'utf8');
          if (text === lastWritten) return;
          cache = sanitize(JSON.parse(text));
          lastWritten = text;
          onChange(cache);
        } catch {}
      }, 150);
    });
  } catch {}
}
