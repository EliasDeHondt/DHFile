import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, nativeTheme, net, protocol, shell } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { release, userInfo } from 'node:os';
import { join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { changePin, idleFor, isUnlocked, lockApp, lockStatus, markActivity, setupPin, unlock, verify } from './lock';
import { getSettings, saveSettings, settingsPath, watchSettings } from './settings';
import * as fsx from './fsops';
import * as sys from './system';
import { shellIcon, stopIcons, warmIcons } from './native-icons';
import { extOf, normalizePath } from '../shared/files';
import { AppInfo, Settings, TransferRequest } from '../shared/types';

protocol.registerSchemesAsPrivileged([{ scheme: 'dhfile', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
if (process.env['DHFILE_USER_DATA']) app.setPath('userData', process.env['DHFILE_USER_DATA']);
app.setAppUserModelId('com.eliasdehondt.dhfile');

const RENDERER = join(__dirname, '..', '..', 'renderer', 'browser');
const ICON = join(__dirname, '..', '..', '..', 'build', 'icon.png');
const launch = new Map<number, string | null>();
const watchers = new fsx.Watchers();
const searches = new Set<string>();
const propJobs = new Set<string>();
let dragIcon: Electron.NativeImage | null = null;

function parseArgs(argv: string[], workingDirectory: string): string | null {
  const start = process.defaultApp ? 2 : 1;
  for (let i = start; i < argv.length; i++) {
    let a = argv[i];
    if (a === '--cwd' || a === '-d') a = argv[++i] ?? '';
    else if (a.startsWith('--cwd=')) a = a.slice(6);
    else if (a.startsWith('-')) continue;
    if (!a) continue;
    const p = resolve(workingDirectory, a.replace(/"+$/, ''));
    try { statSync(p); return normalizePath(p); } catch {}
  }
  return null;
}

const isDark = (s: Settings) => s.theme === 'dark' || (s.theme === 'system' && nativeTheme.shouldUseDarkColors);
const dim = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * 0.55).toString(16).padStart(2, '0')).join(''); };
const chrome = (dark: boolean, mica: boolean, modal = false) => {
  const color = dark ? '#060709' : '#eef1f5', symbol = dark ? '#edeff2' : '#0c0e11';
  return { color: modal ? (mica ? '#00000073' : dim(color)) : mica ? '#00000000' : color, symbolColor: modal ? dim(symbol) : symbol, height: 40 };
};

function createWindow(path: string | null) {
  const s = getSettings();
  const dark = isDark(s);
  const mica = s.mica && process.platform === 'win32' && Number(release().split('.')[2]) >= 22000;
  const win = new BrowserWindow({
    width: 1240, height: 780, minWidth: 560, minHeight: 360, show: false,
    backgroundColor: mica ? '#00000000' : dark ? '#060709' : '#eef1f5',
    ...(mica ? { backgroundMaterial: 'mica' as const } : {}),
    titleBarStyle: 'hidden', titleBarOverlay: chrome(dark, mica), icon: ICON,
    webPreferences: { preload: join(__dirname, '..', 'preload', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  const wc = win.webContents;
  const wcId = wc.id;
  launch.set(wcId, path);
  win.setMenuBarVisibility(false);
  win.loadURL('dhfile://app/index.html');
  win.once('ready-to-show', () => win.show());
  win.on('enter-full-screen', () => wc.send('window:fullscreen', true));
  win.on('leave-full-screen', () => wc.send('window:fullscreen', false));
  win.on('closed', () => { watchers.clearPrefix(wcId + ':'); launch.delete(wcId); });
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  wc.on('will-navigate', (e, url) => { if (!url.startsWith('dhfile://app/')) e.preventDefault(); });
  return win;
}

const thumbs = new Map<string, Buffer>();
const png = (buf: Buffer) => new Response(new Uint8Array(buf), { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=3600' } });
const notFound = () => new Response(null, { status: 404 });
const genericExts = new Set<string>();
function remember(key: string, buf: Buffer) {
  thumbs.set(key, buf);
  if (thumbs.size > 1500) thumbs.delete(thumbs.keys().next().value!);
  return buf;
}

function serve() {
  protocol.handle('dhfile', async request => {
    const url = new URL(request.url);
    if (url.host === 'thumb') {
      if (!isUnlocked()) return notFound();
      const path = url.searchParams.get('p') ?? '';
      const size = Math.min(512, Math.max(16, Number(url.searchParams.get('s')) || 96));
      const key = `thumb|${size}|${url.searchParams.get('m') ?? ''}|${path}`;
      const hit = thumbs.get(key);
      if (hit) return png(hit);
      try {
        const img = await nativeImage.createThumbnailFromPath(path, { width: size, height: size });
        if (img.isEmpty()) return notFound();
        return png(remember(key, img.toPNG()));
      } catch { return notFound(); }
    }
    if (url.host === 'icon') {
      if (!isUnlocked()) return notFound();
      const path = url.searchParams.get('p') ?? '';
      const size = Math.min(256, Math.max(16, Number(url.searchParams.get('s')) || 32));
      const byExt = url.searchParams.get('e') === '1';
      const ext = extOf(path);
      if (byExt && (!ext || genericExts.has(ext))) return notFound();
      const key = byExt ? `ext|${size}|${ext}` : `icon|${size}|${path}`;
      const hit = thumbs.get(key);
      if (hit) return png(hit);
      const fromShell = await shellIcon(path, size, byExt);
      if (fromShell === 'generic') { genericExts.add(ext); return notFound(); }
      if (fromShell?.length) return png(remember(key, fromShell));
      if (byExt) return notFound();
      try {
        const img = await app.getFileIcon(path, { size: size > 24 ? 'large' : 'small' });
        if (img.isEmpty()) return notFound();
        return png(remember(key, img.toPNG()));
      } catch { return notFound(); }
    }
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
    let file = normalize(join(RENDERER, pathname));
    if (!file.startsWith(RENDERER) || !existsSync(file)) file = join(RENDERER, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
}

const broadcast = (channel: string, payload?: unknown) => { for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload); };
const winOf = (e: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) => BrowserWindow.fromWebContents(e.sender);
const LOCKED = { ok: false, error: 'locked' };
const str = (v: unknown) => String(v ?? '');
const strs = (v: unknown) => Array.isArray(v) ? v.map(String).filter(Boolean) : [];

function registerIpc() {
  ipcMain.handle('app:info', e => {
    const info: AppInfo = {
      version: app.getVersion(), platform: process.platform, osBuild: Number(release().split('.')[2]) || 0, packaged: app.isPackaged,
      initialPath: launch.get(e.sender.id) ?? null, settingsPath: settingsPath(), home: app.getPath('home'), user: userInfo().username,
      places: sys.places(), terminal: sys.terminalKind(), vscode: sys.hasVsCode(),
    };
    return info;
  });
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:set', (_e, next: Settings) => {
    const before = getSettings();
    const saved = saveSettings(next);
    broadcast('settings:changed', saved);
    if (before.theme !== saved.theme) applyTheme(saved);
    return saved;
  });
  ipcMain.handle('settings:open-file', () => shell.openPath(settingsPath()));

  ipcMain.handle('fs:list', (_e, path: string) => isUnlocked() ? fsx.list(str(path)) : { path: str(path), entries: [], error: 'locked', code: 'LOCKED' });
  ipcMain.handle('fs:peek', (_e, path: string) => isUnlocked() ? fsx.peek(str(path)) : []);
  ipcMain.handle('fs:drives', (_e, refresh?: boolean) => isUnlocked() ? sys.drives(!!refresh) : []);
  ipcMain.handle('fs:network', () => isUnlocked() ? sys.networkLocations() : []);
  ipcMain.handle('fs:resolve', async (_e, input: string) => {
    if (!isUnlocked()) return null;
    let p = str(input).trim().replace(/^"(.*)"$/, '$1');
    if (!p) return null;
    p = p.replace(/%([^%]+)%/g, (m, k) => process.env[k] ?? process.env[Object.keys(process.env).find(x => x.toLowerCase() === k.toLowerCase()) ?? ''] ?? m);
    if (p === '~' || p.startsWith('~\\') || p.startsWith('~/')) p = join(app.getPath('home'), p.slice(1));
    const full = normalizePath(resolve(p));
    if (!(await fsx.exists(full))) return null;
    return { path: full, dir: await fsx.isDirectory(full) };
  });
  ipcMain.handle('fs:mkdir', (_e, dir: string, name: string) => isUnlocked() ? fsx.mkdirUnique(str(dir), str(name) || 'New folder') : LOCKED);
  ipcMain.handle('fs:newfile', (_e, dir: string, name: string) => isUnlocked() ? fsx.newFile(str(dir), str(name) || 'New Text Document.txt') : LOCKED);
  ipcMain.handle('fs:rename', (_e, path: string, name: string) => isUnlocked() ? fsx.renameEntry(str(path), str(name)) : LOCKED);
  ipcMain.handle('fs:trash', async (_e, paths: string[]) => {
    if (!isUnlocked()) return LOCKED;
    for (const p of strs(paths)) { try { await shell.trashItem(p); } catch (err: any) { return { ok: false, error: String(err?.message ?? err) }; } }
    return { ok: true };
  });
  ipcMain.handle('fs:delete', (_e, paths: string[]) => isUnlocked() ? fsx.remove(strs(paths)) : LOCKED);
  ipcMain.handle('fs:transfer', (_e, req: TransferRequest) => isUnlocked() ? fsx.transfer({ sources: strs(req?.sources), dest: str(req?.dest), mode: req?.mode === 'move' ? 'move' : 'copy', conflict: req?.conflict ?? 'ask' }) : { ok: false, created: [], failed: [] });
  ipcMain.handle('fs:props', async (e, id: string, path: string) => {
    if (!isUnlocked()) return null;
    const key = e.sender.id + ':' + id;
    propJobs.add(key);
    try {
      const sender = e.sender;
      const p = await fsx.properties(str(path), props => { if (!sender.isDestroyed()) sender.send('props:update', { id, props }); }, () => !propJobs.has(key));
      const lnk = /\.lnk$/i.test(p.path) ? (() => { try { return shell.readShortcutLink(p.path).target; } catch { return undefined; } })() : undefined;
      return { ...p, target: lnk };
    } catch { return null; } finally { propJobs.delete(key); }
  });
  ipcMain.on('props:cancel', (e, id: string) => propJobs.delete(e.sender.id + ':' + id));
  ipcMain.handle('fs:readonly', (_e, path: string, on: boolean) => isUnlocked() ? fsx.setReadonly(str(path), !!on) : LOCKED);
  ipcMain.handle('fs:preview', (_e, path: string) => isUnlocked() ? fsx.preview(str(path)) : { kind: 'none' });
  ipcMain.on('fs:watch', (e, tab: number, path: string | null) => {
    const sender = e.sender;
    watchers.set(`${sender.id}:${tab}`, isUnlocked() && path ? str(path) : null, () => { if (!sender.isDestroyed()) sender.send('fs:changed', tab); });
  });
  ipcMain.on('fs:search', (e, token: string, root: string, query: string) => {
    if (!isUnlocked()) return;
    const sender = e.sender, key = sender.id + ':' + token;
    searches.add(key);
    const send = (entries: unknown[], done: boolean) => { if (!sender.isDestroyed()) sender.send('search:results', { token, entries, done }); };
    fsx.search(str(root), str(query), batch => send(batch, false), () => !searches.has(key) || sender.isDestroyed())
      .catch(() => {}).finally(() => { if (searches.delete(key)) send([], true); });
  });
  ipcMain.on('fs:search-cancel', (e, token: string) => searches.delete(e.sender.id + ':' + token));

  ipcMain.handle('shell:open', async (_e, path: string) => {
    if (!isUnlocked()) return LOCKED;
    const err = await shell.openPath(str(path));
    return err ? { ok: false, error: err } : { ok: true };
  });
  ipcMain.handle('shell:shortcut', (_e, path: string) => { try { return shell.readShortcutLink(str(path)).target || null; } catch { return null; } });
  ipcMain.on('shell:open-with', (_e, path: string) => { if (isUnlocked()) sys.openWith(str(path)); });
  ipcMain.on('shell:terminal', (_e, path: string) => { if (isUnlocked()) sys.openTerminal(str(path)); });
  ipcMain.on('shell:vscode', (_e, path: string) => { if (isUnlocked()) sys.openVsCode(str(path)); });
  ipcMain.on('shell:explorer', (_e, path: string, select: boolean) => { if (isUnlocked()) sys.showInExplorer(str(path), !!select); });
  ipcMain.on('shell:recycle', () => { if (isUnlocked()) sys.openRecycleBin(); });
  ipcMain.handle('clip:read-files', () => isUnlocked() ? sys.readFilesFromClipboard() : []);
  ipcMain.on('clip:write-files', (_e, paths: string[]) => { if (isUnlocked()) sys.writeFilesToClipboard(strs(paths)); });
  ipcMain.on('clip:write-text', (_e, text: string) => clipboard.writeText(str(text)));
  ipcMain.on('drag:start', (e, paths: string[]) => {
    const files = strs(paths);
    if (!files.length || !isUnlocked()) return;
    dragIcon ??= nativeImage.createFromPath(ICON).resize({ width: 32, height: 32 });
    try { e.sender.startDrag({ file: files[0], files, icon: dragIcon }); } catch {}
  });
  ipcMain.handle('sys:default-app', async (_e, on: boolean) => sys.setDefaultFolderApp(!!on));
  ipcMain.handle('sys:default-app-status', () => sys.isDefaultFolderApp());
  ipcMain.handle('folder:pick', async e => {
    const w = winOf(e);
    const r = await (w ? dialog.showOpenDialog(w, { properties: ['openDirectory'] }) : dialog.showOpenDialog({ properties: ['openDirectory'] }));
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.on('link:open', (_e, url: string) => { if (/^https?:\/\//i.test(str(url))) shell.openExternal(str(url)); });
  ipcMain.on('window:new', (_e, path?: string) => createWindow(typeof path === 'string' ? path : null));
  ipcMain.on('window:close', e => winOf(e)?.close());
  ipcMain.on('window:chrome', (e, dark: boolean, mica: boolean, modal: boolean) => {
    const w = winOf(e);
    if (!w) return;
    try { w.setTitleBarOverlay(chrome(!!dark, !!mica, !!modal)); w.setMinimizable(!modal); w.setMaximizable(!modal); w.setClosable(!modal); } catch {}
  });

  const lockChanged = () => { if (!isUnlocked()) watchers.clearPrefix(''); broadcast('lock:changed', isUnlocked()); };
  const opening = (r: { ok: boolean }) => { if (r.ok) lockChanged(); return r; };
  ipcMain.handle('lock:status', () => lockStatus());
  ipcMain.handle('lock:setup', (_e, pin: string) => opening(setupPin(str(pin))));
  ipcMain.handle('lock:unlock', (_e, pin: string) => opening(unlock(str(pin))));
  ipcMain.handle('lock:verify', (_e, pin: string) => verify(str(pin)));
  ipcMain.handle('lock:change', (_e, current: string, next: string) => changePin(str(current), str(next)));
  ipcMain.on('lock:lock', () => { if (isUnlocked()) { lockApp(); lockChanged(); } });
  ipcMain.on('lock:activity', () => markActivity());
  setInterval(() => {
    if (isUnlocked() && idleFor() >= getSettings().autoLockMinutes * 60_000) { lockApp(); lockChanged(); }
  }, 15_000).unref();
}

function applyTheme(s: Settings) { nativeTheme.themeSource = s.theme; }

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_e, argv, workingDirectory) => createWindow(parseArgs(argv, workingDirectory)));
  app.whenReady().then(() => {
    serve();
    registerIpc();
    applyTheme(getSettings());
    watchSettings(s => { applyTheme(s); broadcast('settings:changed', s); });
    nativeTheme.on('updated', () => broadcast('theme:system', nativeTheme.shouldUseDarkColors));
    sys.drives().catch(() => {});
    createWindow(parseArgs(process.argv, process.cwd()));
    setTimeout(warmIcons, 800);
  });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => stopIcons());
}
