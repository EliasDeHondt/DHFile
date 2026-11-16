/**
    * @author Group DH Team
    * @see https://group-dh.com
    * @since 16/11/2026
**/

import { app, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { existsSync, readdirSync, statfsSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { Drive, DriveType, OpResult, Place } from '../shared/types';

const run = (file: string, args: string[], timeout = 8000) => new Promise<{ ok: boolean; out: string }>(resolve => {
  execFile(file, args, { windowsHide: true, timeout, maxBuffer: 8 << 20 }, (err, stdout) => resolve({ ok: !err, out: String(stdout ?? '') }));
});
const ps = (script: string, timeout = 8000) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' + script], timeout);
const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function places(): Place[] {
  const out: Place[] = [{ id: 'home', path: app.getPath('home') }];
  for (const id of ['desktop', 'downloads', 'documents', 'pictures', 'music', 'videos'] as const) {
    try { const p = app.getPath(id); if (existsSync(p)) out.push({ id, path: p }); } catch {}
  }
  const od = process.env['OneDrive'];
  if (od && existsSync(od)) out.push({ id: 'onedrive', path: od });
  return out;
}

const TYPES: Record<number, DriveType> = { 2: 'removable', 3: 'fixed', 4: 'network', 5: 'cd', 6: 'ram' };
let driveMeta: Record<string, { label: string; type: DriveType }> = {};
let metaLoaded: Promise<void> | null = null;

function loadDriveMeta(): Promise<void> {
  return ps('Get-CimInstance Win32_LogicalDisk | ForEach-Object { "$($_.DeviceID)|$($_.DriveType)|$($_.ProviderName)|$($_.VolumeName)" }').then(r => {
    const next: typeof driveMeta = {};
    for (const line of r.out.split(/\r?\n/)) {
      const [id, type, provider, ...label] = line.trim().split('|');
      if (!/^[A-Z]:$/i.test(id ?? '')) continue;
      const share = (provider ?? '').match(/^\\\\([^\\]+)\\(.+)$/);
      const name = label.join('|').trim() || (share ? `${share[2].split('\\').pop()} (\\\\${share[1]})` : '');
      next[id.toUpperCase()] = { type: TYPES[Number(type)] ?? 'unknown', label: name };
    }
    driveMeta = next;
  });
}

export async function drives(refreshMeta = false): Promise<Drive[]> {
  if (process.platform !== 'win32') return [{ letter: '/', path: '/', label: '', type: 'fixed', total: 0, free: 0 }];
  if (!metaLoaded || refreshMeta) metaLoaded = loadDriveMeta().catch(() => {});
  await Promise.race([metaLoaded, new Promise(r => setTimeout(r, 1500))]);
  const out: Drive[] = [];
  for (let c = 65; c <= 90; c++) {
    const letter = String.fromCharCode(c) + ':';
    const meta = driveMeta[letter];
    const path = letter + '\\';
    let total = 0, free = 0;
    if (meta?.type !== 'network') {
      try { const s = statfsSync(path); total = s.blocks * s.bsize; free = s.bavail * s.bsize; }
      catch { if (!meta) continue; }
    } else {
      const s = await Promise.race([statfs(path).catch(() => null), new Promise<null>(r => setTimeout(() => r(null), 1200))]);
      if (s) { total = s.blocks * s.bsize; free = s.bavail * s.bsize; }
    }
    out.push({ letter, path, label: meta?.label ?? '', type: meta?.type ?? 'fixed', total, free });
  }
  return out;
}

export function networkLocations(): { name: string; path: string }[] {
  const dir = join(process.env['APPDATA'] ?? '', 'Microsoft', 'Windows', 'Network Shortcuts');
  const out: { name: string; path: string }[] = [];
  try {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      try {
        const lnk = d.isDirectory() ? join(dir, d.name, 'target.lnk') : d.name.toLowerCase().endsWith('.lnk') ? join(dir, d.name) : '';
        const target = lnk && existsSync(lnk) ? shell.readShortcutLink(lnk).target : '';
        if (target) out.push({ name: d.name.replace(/\.lnk$/i, ''), path: target });
      } catch {}
    }
  } catch {}
  return out;
}

const localApp = (...p: string[]) => join(process.env['LOCALAPPDATA'] ?? '', ...p);
const DHTERMINAL = () => localApp('Programs', 'DHTerminal', 'DHTerminal.exe');
const WT = () => localApp('Microsoft', 'WindowsApps', 'wt.exe');
const CODE = () => [localApp('Programs', 'Microsoft VS Code', 'Code.exe'), join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Microsoft VS Code', 'Code.exe')].find(existsSync);

export const terminalKind = (): 'dhterminal' | 'wt' | 'powershell' => existsSync(DHTERMINAL()) ? 'dhterminal' : existsSync(WT()) ? 'wt' : 'powershell';
export const hasVsCode = () => !!CODE();

const detached = (file: string, args: string[], cwd?: string) => {
  const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: false, cwd });
  child.on('error', () => {});
  child.unref();
};

export function openTerminal(dir: string) {
  const kind = terminalKind();
  if (kind === 'dhterminal') detached(DHTERMINAL(), ['--cwd', dir]);
  else if (kind === 'wt') detached(WT(), ['-d', dir]);
  else detached('cmd.exe', ['/c', 'start', '""', 'powershell.exe', '-NoExit'], dir);
}

export function openVsCode(path: string) {
  const code = CODE();
  if (code) detached(code, [path]);
  else detached('cmd.exe', ['/c', 'code', path]);
}

export const openWith = (path: string) => detached('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', path]);
export const showInExplorer = (path: string, select: boolean) => select ? shell.showItemInFolder(path) : detached('explorer.exe', [path]);
export const openRecycleBin = () => detached('explorer.exe', ['shell:RecycleBinFolder']);

export function writeFilesToClipboard(paths: string[]) {
  if (process.platform !== 'win32' || !paths.length) return;
  ps('Set-Clipboard -LiteralPath ' + paths.map(psQuote).join(','), 6000).catch(() => {});
}

export async function readFilesFromClipboard(): Promise<string[]> {
  if (process.platform !== 'win32') return [];
  const r = await ps('Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }', 6000);
  return r.out.split(String.fromCharCode(10)).map(s => s.trim()).filter(Boolean);
}

const KEY_DIR = 'HKCU\\Software\\Classes\\Directory\\shell';
const KEY_DRIVE = 'HKCU\\Software\\Classes\\Drive\\shell';
const KEY_WINE = 'HKCU\\Software\\Classes\\CLSID\\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}';

export async function setDefaultFolderApp(on: boolean): Promise<OpResult> {
  if (process.platform !== 'win32') return { ok: false, error: 'Windows only' };
  if (on && !app.isPackaged) return { ok: false, error: 'dev' };
  const exe = process.execPath;
  const reg = (...args: string[]) => run('reg.exe', args);
  if (on) {
    for (const key of [KEY_DIR, KEY_DRIVE]) {
      await reg('add', `${key}\\DHFile`, '/ve', '/d', 'Open in DHFile', '/f');
      await reg('add', `${key}\\DHFile`, '/v', 'Icon', '/d', `"${exe}",0`, '/f');
      await reg('add', `${key}\\DHFile\\command`, '/ve', '/d', `"${exe}" "%1"`, '/f');
      const r = await reg('add', key, '/ve', '/d', 'DHFile', '/f');
      if (!r.ok) return { ok: false, error: 'registry' };
    }
    await reg('add', `${KEY_WINE}\\shell\\opennewwindow\\command`, '/ve', '/d', `"${exe}"`, '/f');
    await reg('add', `${KEY_WINE}\\shell\\opennewwindow\\command`, '/v', 'DelegateExecute', '/d', '', '/f');
  } else {
    for (const key of [KEY_DIR, KEY_DRIVE]) await reg('delete', key, '/ve', '/f');
    await reg('delete', KEY_WINE, '/f');
  }
  return { ok: true };
}

export async function isDefaultFolderApp(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  const r = await run('reg.exe', ['query', KEY_DIR, '/ve']);
  return r.ok && /REG_SZ\s+DHFile\s*$/im.test(r.out);
}