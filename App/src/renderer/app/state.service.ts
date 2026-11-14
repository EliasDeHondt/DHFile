import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { isInside, normalizePath, PC, samePath } from '../../shared/files';
import { AppInfo, DEFAULT_SETTINGS, Drive, Entry, Settings } from '../../shared/types';
import { bridge } from './bridge';
import { t } from './i18n';
import { FolderTab, SettingsTab, Tab } from './tab';

export type Overlay = null | 'about';
export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'busy'; }
export interface Clip { paths: string[]; mode: 'copy' | 'move'; }

@Injectable({ providedIn: 'root' })
export class StateService {
  private zone = inject(NgZone);
  info = signal<AppInfo | null>(null);
  settings = signal<Settings>(DEFAULT_SETTINGS);
  systemDark = signal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  tabs = signal<Tab[]>([]);
  activeTabId = signal(0);
  overlay = signal<Overlay>(null);
  fullscreen = signal(false);
  drives = signal<Drive[]>([]);
  network = signal<{ name: string; path: string }[]>([]);
  clip = signal<Clip | null>(null);
  toasts = signal<Toast[]>([]);
  settingsSection = signal('general');
  loaded = signal(false);
  private nextTab = 1;
  private nextToast = 1;
  private firstOpened = false;
  private saveTabsTimer: any = null;

  dark = computed(() => { const th = this.settings().theme; return th === 'dark' || (th === 'system' && this.systemDark()); });
  mica = computed(() => this.settings().mica && (this.info()?.osBuild ?? 0) >= 22000);
  activeTab = computed(() => this.tabs().find(x => x.id === this.activeTabId()) ?? null);
  activeFolder = computed(() => { const tab = this.activeTab(); return tab instanceof FolderTab ? tab : null; });
  places = computed(() => this.info()?.places ?? []);

  async init() {
    this.listen();
    const [info, settings] = await Promise.all([bridge.info(), bridge.getSettings()]);
    this.info.set(info);
    this.settings.set(settings);
    if (!settings.pinsSeeded) {
      // First run: Downloads and Documents are pinned; the rest is up to you.
      const wanted = ['downloads', 'documents'].map(id => info.places.find(p => p.id === id)?.path).filter((p): p is string => !!p);
      await this.saveSettings({ pinned: [...wanted, ...settings.pinned.filter(p => !wanted.some(w => samePath(w, p)))], pinsSeeded: true });
    }
    this.loaded.set(true);
  }

  /** Runs once the PIN lock is open. */
  openFirstTabs() {
    if (this.firstOpened || !this.loaded()) return;
    this.firstOpened = true;
    this.refreshDrives();
    const info = this.info()!, s = this.settings();
    if (info.initialPath) { this.openPath(info.initialPath); return; }
    if (s.startup === 'last' && s.lastTabs.length) { for (const p of s.lastTabs) this.newTab(p, false); this.activeTabId.set(this.tabs()[0]?.id ?? 0); return; }
    this.newTab(this.startPath());
  }

  /** After unlocking again: reload what is on screen (watchers were dropped while locked). */
  reloadAll() { for (const tab of this.tabs()) if (tab instanceof FolderTab) tab.load(); this.refreshDrives(); }

  startPath(): string {
    const s = this.settings();
    if (s.startup === 'pc') return PC;
    if (s.startup === 'custom' && s.startupPath) return s.startupPath;
    return this.info()?.home ?? PC;
  }

  private listen() {
    bridge.on('settings:changed', (s: Settings) => this.zone.run(() => this.settings.set(s)));
    bridge.on('theme:system', (dark: boolean) => this.zone.run(() => this.systemDark.set(dark)));
    bridge.on('window:fullscreen', (on: boolean) => this.zone.run(() => this.fullscreen.set(on)));
    bridge.on('fs:changed', (id: number) => this.zone.run(() => { const tab = this.tabs().find(x => x.id === id); if (tab instanceof FolderTab) tab.refresh(); }));
    bridge.on('search:results', ({ token, entries, done }: { token: string; entries: Entry[]; done: boolean }) => this.zone.run(() => { for (const tab of this.tabs()) if (tab instanceof FolderTab) tab.onResults(token, entries, done); }));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => this.systemDark.set(e.matches));
  }

  async refreshDrives(refresh = false) {
    bridge.network().then(n => this.network.set(n));
    this.drives.set(await bridge.drives(refresh));
  }

  async saveSettings(patch: Partial<Settings>) {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    this.settings.set(await bridge.setSettings(next));
  }
  toggleTheme() { this.saveSettings({ theme: this.dark() ? 'light' : 'dark' }); }

  /* ---------- tabs ---------- */

  newTab(path: string = this.startPath(), activate = true): FolderTab {
    const tab = new FolderTab(this.nextTab++, () => this.rememberTabs());
    this.tabs.update(list => [...list, tab]);
    if (activate) this.activeTabId.set(tab.id);
    tab.go(path);
    return tab;
  }

  /** Opens a folder in the current tab, or a file's folder with the file selected. */
  async openPath(path: string) {
    const r = path === PC ? { path: PC, dir: true } : await bridge.resolve(path);
    if (!r) { this.toast(t('err.notFound', { path }), 'error'); if (!this.tabs().length) this.newTab(this.startPath()); return; }
    const parent = r.dir ? r.path : r.path.slice(0, r.path.lastIndexOf('\\')) || r.path;
    const tab = this.activeFolder() ?? this.newTab(parent);
    tab.go(r.dir ? r.path : parent, { select: r.dir ? undefined : r.path });
  }

  activateTab(id: number) { this.activeTabId.set(id); }
  closeTab(id: number) {
    const list = this.tabs(), i = list.findIndex(x => x.id === id);
    if (i < 0) return;
    const tab = list[i];
    if (tab instanceof FolderTab) tab.dispose();
    const next = list.filter(x => x.id !== id);
    this.tabs.set(next);
    if (!next.length) { bridge.closeWindow(); return; }
    if (this.activeTabId() === id) this.activeTabId.set(next[Math.min(i, next.length - 1)].id);
    this.rememberTabs();
  }
  closeOtherTabs(id: number) { for (const tab of this.tabs()) if (tab.id !== id) this.closeTab(tab.id); }
  duplicateTab(tab: FolderTab) { const copy = this.newTab(tab.path()); return copy; }
  moveTab(id: number, to: number) {
    const list = [...this.tabs()], from = list.findIndex(x => x.id === id);
    if (from < 0) return;
    const [tab] = list.splice(from, 1);
    list.splice(Math.max(0, Math.min(to, list.length)), 0, tab);
    this.tabs.set(list);
    this.rememberTabs();
  }
  cycleTab(delta: number) {
    const list = this.tabs(), i = list.findIndex(x => x.id === this.activeTabId());
    if (list.length) this.activeTabId.set(list[(i + delta + list.length) % list.length].id);
  }
  openSettings(section?: string) {
    if (section) this.settingsSection.set(section);
    const existing = this.tabs().find(x => x instanceof SettingsTab);
    if (existing) { this.activeTabId.set(existing.id); return; }
    const tab = new SettingsTab(this.nextTab++);
    this.tabs.update(list => [...list, tab]);
    this.activeTabId.set(tab.id);
  }

  tabTitle(tab: Tab): string {
    if (tab instanceof SettingsTab) return t('common.settings');
    const info = this.info();
    return tab.title({ pc: t('place.pc'), drive: l => this.driveName(l), home: info?.home ?? '', user: info?.user ?? t('place.home') }) || '…';
  }

  private rememberTabs() {
    clearTimeout(this.saveTabsTimer);
    this.saveTabsTimer = setTimeout(() => {
      const paths = this.tabs().filter((x): x is FolderTab => x instanceof FolderTab).map(x => x.path()).filter(Boolean);
      const s = this.settings();
      if (paths.length && JSON.stringify(paths) !== JSON.stringify(s.lastTabs)) this.saveSettings({ lastTabs: paths });
    }, 1200);
  }

  /* ---------- places ---------- */

  specialOf(path: string): string | undefined {
    const p = this.places().find(x => samePath(x.path, path));
    return p?.id;
  }
  driveName(letter: string): string {
    const d = this.drives().find(x => x.letter.toUpperCase() === letter.toUpperCase());
    const label = d?.label || (d?.type === 'removable' ? t('drive.usb') : d?.type === 'network' ? t('drive.network') : d?.type === 'cd' ? t('drive.cd') : t('drive.local'));
    return `${label} (${letter.toUpperCase()})`;
  }
  isPinned(path: string) { return this.settings().pinned.some(p => samePath(p, path)); }
  pin(path: string) { if (!this.isPinned(path)) this.saveSettings({ pinned: [...this.settings().pinned, normalizePath(path)] }); }
  movePin(path: string, delta: number) {
    const list = [...this.settings().pinned], i = list.findIndex(p => samePath(p, path)), j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.saveSettings({ pinned: list });
  }
  unpin(path: string) { this.saveSettings({ pinned: this.settings().pinned.filter(p => !samePath(p, path)) }); }

  /* ---------- clipboard ---------- */

  setClip(paths: string[], mode: 'copy' | 'move') {
    if (!paths.length) return;
    this.clip.set({ paths, mode });
    bridge.writeClipboardFiles(paths);
  }
  isCut(path: string) { const c = this.clip(); return c?.mode === 'move' && c.paths.includes(path); }
  /** Our own clipboard wins when Windows still holds the same files, otherwise use what Explorer (or another app) copied. */
  async readClip(): Promise<Clip | null> {
    const own = this.clip();
    const files = await bridge.readClipboardFiles();
    if (!files.length) return own;
    if (own && files.length === own.paths.length && files.every((f, i) => samePath(f, own.paths[i]))) return own;
    return { paths: files, mode: 'copy' };
  }
  clipDone(clip: Clip) { if (clip.mode === 'move' && this.clip() === clip) this.clip.set(null); }
  touches(path: string, clip: Clip | null) { return !!clip && clip.paths.some(p => isInside(path, p)); }

  /* ---------- toasts ---------- */

  toast(text: string, kind: Toast['kind'] = 'info', ms = 3500): number {
    const id = this.nextToast++;
    this.toasts.update(list => [...list.slice(-3), { id, text, kind }]);
    if (kind !== 'busy') setTimeout(() => this.dismiss(id), ms);
    return id;
  }
  dismiss(id: number) { this.toasts.update(list => list.filter(x => x.id !== id)); }
  closeOverlay() { this.overlay.set(null); }
}
