import { AppInfo, Drive, Entry, Listing, LockStatus, OpenWithApp, OpResult, Preview, Properties, Settings, TransferRequest, TransferResult, UnlockResult } from '../../shared/types';

interface Api {
  invoke(channel: string, ...args: unknown[]): Promise<any>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (payload: any) => void): () => void;
  pathForFile(file: File): string;
}

const api: Api = (window as any).dhfile;

export const bridge = {
  info: (): Promise<AppInfo> => api.invoke('app:info'),
  getSettings: (): Promise<Settings> => api.invoke('settings:get'),
  setSettings: (s: Settings): Promise<Settings> => api.invoke('settings:set', s),
  openSettingsFile: (): Promise<string> => api.invoke('settings:open-file'),

  list: (path: string): Promise<Listing> => api.invoke('fs:list', path),
  peek: (path: string): Promise<Entry[]> => api.invoke('fs:peek', path),
  drives: (refresh = false): Promise<Drive[]> => api.invoke('fs:drives', refresh),
  network: (): Promise<{ name: string; path: string }[]> => api.invoke('fs:network'),
  resolve: (input: string): Promise<{ path: string; dir: boolean } | null> => api.invoke('fs:resolve', input),
  mkdir: (dir: string, name: string): Promise<OpResult> => api.invoke('fs:mkdir', dir, name),
  newFile: (dir: string, name: string): Promise<OpResult> => api.invoke('fs:newfile', dir, name),
  rename: (path: string, name: string): Promise<OpResult> => api.invoke('fs:rename', path, name),
  trash: (paths: string[]): Promise<OpResult> => api.invoke('fs:trash', paths),
  remove: (paths: string[]): Promise<OpResult> => api.invoke('fs:delete', paths),
  transfer: (req: TransferRequest): Promise<TransferResult> => api.invoke('fs:transfer', req),
  properties: (id: string, path: string): Promise<Properties | null> => api.invoke('fs:props', id, path),
  cancelProperties: (id: string) => api.send('props:cancel', id),
  setReadonly: (path: string, on: boolean): Promise<OpResult> => api.invoke('fs:readonly', path, on),
  preview: (path: string): Promise<Preview> => api.invoke('fs:preview', path),
  watch: (tab: number, path: string | null) => api.send('fs:watch', tab, path),
  search: (token: string, root: string, query: string) => api.send('fs:search', token, root, query),
  cancelSearch: (token: string) => api.send('fs:search-cancel', token),

  open: (path: string): Promise<OpResult> => api.invoke('shell:open', path),
  shortcutTarget: (path: string): Promise<string | null> => api.invoke('shell:shortcut', path),
  openWith: (path: string) => api.send('shell:open-with', path),
  openWithApps: (path: string, size: number): Promise<OpenWithApp[]> => api.invoke('shell:apps', path, size),
  openWithApp: (path: string, id: string): Promise<OpResult> => api.invoke('shell:open-app', path, id),
  openTerminal: (path: string) => api.send('shell:terminal', path),
  openVsCode: (path: string) => api.send('shell:vscode', path),
  showInExplorer: (path: string, select: boolean) => api.send('shell:explorer', path, select),
  openRecycleBin: () => api.send('shell:recycle'),
  readClipboardFiles: (): Promise<string[]> => api.invoke('clip:read-files'),
  writeClipboardFiles: (paths: string[]) => api.send('clip:write-files', paths),
  writeClipboardText: (text: string) => api.send('clip:write-text', text),
  startDrag: (paths: string[]) => api.send('drag:start', paths),
  pathForFile: (file: File): string => api.pathForFile(file),
  setDefaultFolderApp: (on: boolean): Promise<OpResult> => api.invoke('sys:default-app', on),
  isDefaultFolderApp: (): Promise<boolean> => api.invoke('sys:default-app-status'),
  pickFolder: (): Promise<string | null> => api.invoke('folder:pick'),

  openLink: (url: string) => api.send('link:open', url),
  newWindow: (path?: string) => api.send('window:new', path),
  closeWindow: () => api.send('window:close'),
  setChrome: (dark: boolean, mica: boolean, modal: boolean) => api.send('window:chrome', dark, mica, modal),

  lockStatus: (): Promise<LockStatus> => api.invoke('lock:status'),
  setupPin: (pin: string): Promise<UnlockResult> => api.invoke('lock:setup', pin),
  unlock: (pin: string): Promise<UnlockResult> => api.invoke('lock:unlock', pin),
  verifyPin: (pin: string): Promise<UnlockResult> => api.invoke('lock:verify', pin),
  changePin: (current: string, next: string): Promise<UnlockResult> => api.invoke('lock:change', current, next),
  lock: () => api.send('lock:lock'),
  activity: () => api.send('lock:activity'),
  on: (channel: string, listener: (payload: any) => void) => api.on(channel, listener),
};

export const thumbUrl = (e: Entry, size: number) => `dhfile://thumb/?p=${encodeURIComponent(e.path)}&s=${size}&m=${Math.round(e.mtime)}`;
const ICON_SIZES = [16, 24, 32, 48, 64, 96, 128, 256];
export const iconSize = (px: number) => { const want = px * (window.devicePixelRatio || 1); return ICON_SIZES.find(b => b >= want) ?? 256; };
export const nativeIconUrl = (path: string, px: number) => `dhfile://icon/?p=${encodeURIComponent(path)}&s=${iconSize(px)}`;
const typeSamples = new Map<string, string>();
export function typeIconUrl(path: string, ext: string, px: number) {
  let sample = typeSamples.get(ext);
  if (!sample) { sample = path; typeSamples.set(ext, sample); }
  return `dhfile://icon/?e=1&p=${encodeURIComponent(sample)}&s=${iconSize(px)}`;
}
