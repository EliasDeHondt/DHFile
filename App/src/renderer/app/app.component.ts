import { ChangeDetectionStrategy, Component, HostListener, NgZone, effect, inject, signal, untracked } from '@angular/core';
import { bridge } from './bridge';
import { enableCustomSelects } from './custom-select';
import { ExplorerComponent } from './explorer.component';
import { language, TPipe } from './i18n';
import { FileIconComponent, IconComponent } from './icon.component';
import { LockScreenComponent } from './lock-screen.component';
import { LockService } from './lock.service';
import { SettingsComponent } from './settings.component';
import { StateService } from './state.service';
import { FolderTab, Tab } from './tab';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FileIconComponent, ExplorerComponent, SettingsComponent, LockScreenComponent, TPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  host: { '[class.dark]': 'state.dark()', '[class.light]': '!state.dark()', '[class.mica]': 'state.mica()', '[class.fullscreen]': 'state.fullscreen()' },
})
export class AppComponent {
  state = inject(StateService);
  lock = inject(LockService);
  menuOpen = signal(false);
  dragTab = signal<number | null>(null);
  dropIndex = signal<number | null>(null);
  tabMenu = signal<{ x: number; y: number; tab: Tab } | null>(null);
  isFolder = (tab: Tab): tab is FolderTab => tab instanceof FolderTab;
  /** True while a dialog with a dark backdrop is open. */
  modal = signal(false);

  constructor() {
    this.state.init();
    this.lock.start();
    enableCustomSelects();
    effect(() => bridge.setChrome(this.state.dark(), this.state.mica(), this.modal()));
    this.watchModals();
    effect(() => { const lang = this.state.settings().language; language.set(lang); document.documentElement.lang = lang; });
    effect(() => { const root = document.documentElement; root.dataset['theme'] = this.state.dark() ? 'dark' : 'light'; root.classList.toggle('mica', this.state.mica()); });
    let wasLocked = false;
    effect(() => {
      const mode = this.lock.mode();
      if (mode === 'unlocked' && this.state.loaded()) untracked(() => { if (wasLocked && this.state.tabs().length) this.state.reloadAll(); else this.state.openFirstTabs(); wasLocked = false; });
      if (mode === 'locked') untracked(() => { wasLocked = true; this.menuOpen.set(false); this.tabMenu.set(null); this.state.closeOverlay(); });
    });
  }

  private watchModals() {
    const zone = inject(NgZone);
    zone.runOutsideAngular(() => {
      let queued = false;
      const check = () => { queued = false; const open = !!document.querySelector('.overlay:not(.overlay--clear)'); if (open !== this.modal()) zone.run(() => this.modal.set(open)); };
      new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(check); } }).observe(document.body, { childList: true, subtree: true });
    });
  }

  tabMouseDown(ev: MouseEvent, tab: Tab) {
    if (ev.button === 1) { ev.preventDefault(); this.state.closeTab(tab.id); }
    else if (ev.button === 0) this.state.activateTab(tab.id);
  }
  tabContext(ev: MouseEvent, tab: Tab) { ev.preventDefault(); this.state.activateTab(tab.id); this.tabMenu.set({ x: ev.clientX, y: ev.clientY, tab }); }
  duplicate(tab: Tab) { this.tabMenu.set(null); if (tab instanceof FolderTab) this.state.duplicateTab(tab); }
  newWindowFrom(tab: Tab) { this.tabMenu.set(null); if (tab instanceof FolderTab) bridge.newWindow(tab.path()); }

  dragStart(ev: DragEvent, tab: Tab) { this.dragTab.set(tab.id); ev.dataTransfer?.setData('application/x-dhfile-tab', String(tab.id)); if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'; }
  dragOver(ev: DragEvent, index: number) {
    if (this.dragTab() === null) return;
    ev.preventDefault();
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.dropIndex.set(ev.clientX < r.left + r.width / 2 ? index : index + 1);
  }
  drop(ev: DragEvent) {
    if (this.dragTab() === null) return;
    ev.preventDefault();
    const id = this.dragTab(), to = this.dropIndex();
    if (id !== null && to !== null) { const from = this.state.tabs().findIndex(x => x.id === id); this.state.moveTab(id, to > from ? to - 1 : to); }
    this.dragEnd();
  }
  dragEnd() { this.dragTab.set(null); this.dropIndex.set(null); }

  menu(action: 'settings' | 'window' | 'lock' | 'about') {
    this.menuOpen.set(false);
    if (action === 'settings') this.state.openSettings();
    else if (action === 'window') bridge.newWindow();
    else if (action === 'lock') this.lock.lock();
    else this.state.overlay.set('about');
  }
  openLink(url: string) { bridge.openLink(url); }
  clampX = (x: number) => Math.max(4, Math.min(x, window.innerWidth - 250));
  clampY = (y: number) => Math.max(4, Math.min(y, window.innerHeight - 200));

  @HostListener('window:keydown', ['$event'])
  windowKey(ev: KeyboardEvent) {
    if (ev.defaultPrevented || this.lock.mode() !== 'unlocked') return;
    if (ev.key === 'Escape' && (this.state.overlay() || this.menuOpen() || this.tabMenu())) { this.menuOpen.set(false); this.tabMenu.set(null); this.state.closeOverlay(); ev.preventDefault(); return; }
    if (!ev.ctrlKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    let handled = true;
    if (k === 't' && !ev.shiftKey) this.state.newTab();
    else if (k === 'w' && !ev.shiftKey) this.state.closeTab(this.state.activeTabId());
    else if (k === 'n' && !ev.shiftKey) bridge.newWindow();
    else if (k === 'tab') this.state.cycleTab(ev.shiftKey ? -1 : 1);
    else if (k === 'pageup') this.state.cycleTab(-1);
    else if (k === 'pagedown') this.state.cycleTab(1);
    else if (k === ',') this.state.openSettings();
    else if (/^[1-9]$/.test(k)) { const list = this.state.tabs(); const tab = k === '9' ? list[list.length - 1] : list[Number(k) - 1]; if (tab) this.state.activateTab(tab.id); }
    else handled = false;
    if (handled) ev.preventDefault();
  }

  @HostListener('window:mousedown', ['$event'])
  outside(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (this.menuOpen() && !target.closest('.menu, .app-menu')) this.menuOpen.set(false);
    if (this.tabMenu() && !target.closest('.menu')) this.tabMenu.set(null);
  }
  @HostListener('window:blur') blur() { this.menuOpen.set(false); this.tabMenu.set(null); }
}
