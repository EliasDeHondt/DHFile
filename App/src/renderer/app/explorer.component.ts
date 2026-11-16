/**
    * @author Group DH Team
    * @see https://group-dh.com
    * @since 16/11/2026
**/

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { baseName, crumbs, displayName, formatSize, hasThumbnail, invalidName, isInside, isTextFile, kindOf, naturalCompare, parentOf, PC, samePath, sortEntries, stem } from '../../shared/files';
import { Conflict, Drive, Entry, OpenWithApp, Preview, Properties, SIDE_SECTIONS, SideSection, SortKey } from '../../shared/types';
import { bridge, iconSize, nativeIconUrl, thumbUrl } from './bridge';
import { language, t, TextKey, TPipe } from './i18n';
import { FileIconComponent, IconComponent } from './icon.component';
import { Clip, StateService } from './state.service';
import { FolderTab } from './tab';

export interface MenuItem { label?: string; icon?: string; img?: string; note?: string; run?: () => void; sub?: () => MenuItem[]; disabled?: boolean; sep?: boolean; checked?: boolean; danger?: boolean; }
type Dialog =
  | { kind: 'delete'; paths: string[]; permanent: boolean }
  | { kind: 'conflict'; names: string[]; resolve: (c: Conflict | null) => void }
  | { kind: 'props'; id: string; props: Properties | null; entry: Entry | null; path: string };

const ROW = 30;
const TILES = { small: { w: 92, h: 98, icon: 44 }, medium: { w: 120, h: 134, icon: 72 }, large: { w: 176, h: 196, icon: 128 } };
const GRID_PAD = 8;
const UNITS: Record<string, string[]> = { en: ['B', 'KB', 'MB', 'GB', 'TB'], nl: ['B', 'kB', 'MB', 'GB', 'TB'] };
const fmtCache = new Map<string, Intl.DateTimeFormat>();
let propSeq = 1;

@Component({
  selector: 'app-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FileIconComponent, TPipe],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.css',
  host: { '(keydown)': 'onKey($event)', '[class.is-grid]': "s().view === 'grid'" },
})
export class ExplorerComponent {
  state = inject(StateService);
  private zone = inject(NgZone);
  private host = inject(ElementRef<HTMLElement>);
  tab = input.required<FolderTab>();
  active = input(false);
  s = this.state.settings;
  viewport = viewChild<ElementRef<HTMLElement>>('viewport');
  addressInput = viewChild<ElementRef<HTMLInputElement>>('addressInput');
  searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  scrollTop = signal(0);
  viewH = signal(600);
  viewW = signal(800);
  editingAddress = signal(false);
  menu = signal<{ x: number; y: number; items: MenuItem[] } | null>(null);
  sub = signal<{ index: number; x: number; y: number; left: number } | null>(null);
  apps = signal<{ path: string; list: OpenWithApp[] | null } | null>(null);
  subItems = computed(() => { const m = this.menu(), s = this.sub(); return m && s ? m.items[s.index]?.sub?.() ?? [] : []; });
  subPos = computed(() => {
    const s = this.sub();
    if (!s) return null;
    const height = this.subItems().reduce((h, i) => h + (i.sep ? 9 : 34), 12);
    const x = s.x + 270 > window.innerWidth ? Math.max(4, s.left - 266) : s.x;
    return { x, y: Math.max(4, Math.min(s.y, window.innerHeight - height - 8)) };
  });
  private subTimer: any = null;
  dialog = signal<Dialog | null>(null);
  dropTarget = signal<string | null>(null);
  marquee = signal<{ x: number; y: number; w: number; h: number } | null>(null);
  preview = signal<Preview | null>(null);
  searchText = signal('');
  resizing = signal(false);
  private typed = ''; private typedAt = 0;
  private searchTimer: any = null;
  private clickDefer: string | null = null;

  PC = PC;
  tile = computed(() => TILES[this.s().iconSize]);
  grid = computed(() => this.s().view === 'grid');
  searching = computed(() => this.tab().results() !== null);
  visible = computed(() => {
    const tab = this.tab(), s = this.s();
    let list = tab.results() ?? tab.entries();
    if (!s.showHidden) list = list.filter(e => !e.hidden);
    return sortEntries(list, s.sortKey, s.sortDir, s.foldersFirst, e => this.typeLabel(e));
  });
  cols = computed(() => this.grid() ? Math.max(1, Math.floor((this.viewW() - GRID_PAD * 2) / this.tile().w)) : 1);
  rowH = computed(() => this.grid() ? this.tile().h : ROW);
  totalRows = computed(() => Math.ceil(this.visible().length / this.cols()));
  range = computed(() => {
    const h = this.rowH();
    const first = Math.max(0, Math.floor(this.scrollTop() / h) - 4);
    const last = Math.min(this.totalRows(), Math.ceil((this.scrollTop() + this.viewH()) / h) + 4);
    return { first, last };
  });
  slice = computed(() => { const { first, last } = this.range(), c = this.cols(); return this.visible().slice(first * c, last * c).map((e, k) => ({ e, i: first * c + k })); });
  padTop = computed(() => this.range().first * this.rowH());
  padBottom = computed(() => Math.max(0, (this.totalRows() - this.range().last) * this.rowH()));
  crumbs = computed(() => crumbs(this.tab().path()));
  crumbsReversed = computed(() => [...this.crumbs()].reverse());
  selectedEntries = computed(() => { const sel = this.tab().selected(); return sel.size ? this.visible().filter(e => sel.has(e.path)) : []; });
  selectedSize = computed(() => this.selectedEntries().reduce((n, e) => n + (e.dir ? 0 : e.size), 0));
  single = computed(() => { const list = this.selectedEntries(); return list.length === 1 ? list[0] : null; });
  folderTitle = computed(() => this.state.tabTitle(this.tab()));
  pinned = computed(() => this.s().pinned);
  usedDrives = computed(() => this.state.drives());

  constructor() {
    effect(() => { this.menu(); untracked(() => { clearTimeout(this.subTimer); this.sub.set(null); }); });
    const destroy = inject(DestroyRef);
    effect(() => { this.tab().path(); untracked(() => { this.editingAddress.set(false); this.searchText.set(this.tab().query()); const vp = this.viewport()?.nativeElement; if (vp) vp.scrollTop = 0; this.scrollTop.set(0); }); });
    effect(() => {
      this.visible(); this.cols();
      const target = untracked(() => this.tab().scrollTo);
      if (!target) return;
      untracked(() => { this.tab().scrollTo = null; const i = this.visible().findIndex(e => e.path === target); if (i >= 0) queueMicrotask(() => this.ensureVisible(i)); });
    });
    effect(() => {
      const e = this.single();
      if (!this.s().preview || !e || e.dir || !isTextFile(e.ext)) { this.preview.set(null); return; }
      untracked(() => bridge.preview(e.path).then(p => { if (this.single()?.path === e.path) this.preview.set(p); }));
    });
    effect(() => { if (this.tab().renaming()) queueMicrotask(() => this.focusRename()); });
    effect(() => { if (this.active()) queueMicrotask(() => { if (!this.host.nativeElement.contains(document.activeElement) || document.activeElement === document.body) this.focusList(); }); });
    effect(onCleanup => {
      const vp = this.viewport()?.nativeElement;
      if (!vp) return;
      const measure = () => this.zone.run(() => { if (vp.clientHeight) { this.viewH.set(vp.clientHeight); this.viewW.set(vp.clientWidth); } this.scrollTop.set(vp.scrollTop); });
      const ro = new ResizeObserver(measure);
      ro.observe(vp);
      vp.addEventListener('scroll', measure, { passive: true });
      queueMicrotask(measure);
      onCleanup(() => { ro.disconnect(); vp.removeEventListener('scroll', measure); });
    });
    const mouseNav = (ev: MouseEvent) => { if (!this.active()) return; if (ev.button === 3) { ev.preventDefault(); this.zone.run(() => this.tab().back()); } else if (ev.button === 4) { ev.preventDefault(); this.zone.run(() => this.tab().forward()); } };
    window.addEventListener('mouseup', mouseNav);
    destroy.onDestroy(() => window.removeEventListener('mouseup', mouseNav));
  }


  name(e: Entry) { return displayName(e, this.s().showExtensions); }
  typeLabel(e: Entry): string {
    if (e.dir) return t('kind.folder');
    const kind = t(('kind.' + kindOf(e)) as TextKey);
    return e.ext ? t('kind.withExt', { kind, ext: e.ext.toUpperCase() }) : kind;
  }
  size(n: number) { return formatSize(n, UNITS[language()] ?? UNITS['en']); }
  date(ms: number) {
    if (!ms) return '';
    const lang = language();
    let f = fmtCache.get(lang);
    if (!f) { f = new Intl.DateTimeFormat(lang === 'nl' ? 'nl-BE' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }); fmtCache.set(lang, f); }
    return f.format(ms);
  }
  longDate(ms: number) { return ms ? new Intl.DateTimeFormat(language() === 'nl' ? 'nl-BE' : 'en-GB', { dateStyle: 'full', timeStyle: 'medium' }).format(ms) : ''; }
  placeLabel(id: string) { return id === 'home' ? (this.state.info()?.user ?? t('place.home')) : t(('place.' + id) as TextKey); }
  special(e: Entry) { return e.dir ? this.state.specialOf(e.path) : undefined; }
  isSelected(e: Entry) { return this.tab().selected().has(e.path); }
  driveUse(d: Drive) { return d.total ? Math.round(((d.total - d.free) / d.total) * 100) : 0; }
  crumbLabel(path: string, label: string) { return /^[A-Z]:\\$/i.test(path) ? this.state.driveName(label) : label; }
  isCurrent(path: string) { return this.tab().path() !== PC && samePath(this.tab().path(), path); }
  thumb(e: Entry, px: number) { return thumbUrl(e, px); }


  go(path: string) { this.menu.set(null); this.tab().go(path); this.focusList(); }
  open(e: Entry, newTab = false) {
    if (e.dir) { if (newTab) this.state.newTab(e.path, false); else this.go(e.path); return; }
    if (e.ext === 'lnk') {
      bridge.shortcutTarget(e.path).then(async target => {
        const r = target ? await bridge.resolve(target) : null;
        if (r?.dir) { if (newTab) this.state.newTab(r.path, false); else this.go(r.path); }
        else this.launch(e.path);
      });
      return;
    }
    this.launch(e.path);
  }
  private async launch(path: string) { const r = await bridge.open(path); if (!r.ok) this.state.toast(t('err.open', { name: baseName(path) }), 'error'); }
  openSelection() {
    const list = this.selectedEntries();
    if (list.length === 1) this.open(list[0]);
    else for (const e of list) if (e.dir) this.state.newTab(e.path, false); else this.launch(e.path);
  }

  startAddressEdit() {
    if (this.editingAddress()) return;
    this.editingAddress.set(true);
    queueMicrotask(() => { const el = this.addressInput()?.nativeElement; if (el) { el.focus(); el.select(); } });
  }
  async commitAddress(value: string) {
    const v = value.trim();
    this.editingAddress.set(false);
    if (!v || (this.tab().path() !== PC && samePath(v, this.tab().path()))) { this.focusList(); return; }
    if (/^(this pc|deze pc|pc:)$/i.test(v)) { this.go(PC); return; }
    const r = await bridge.resolve(v);
    if (!r) { this.state.toast(t('err.notFound', { path: v }), 'error'); return; }
    if (r.dir) this.go(r.path);
    else this.launch(r.path);
  }
  addressKey(ev: KeyboardEvent) {
    ev.stopPropagation();
    if (ev.key === 'Enter') this.commitAddress((ev.target as HTMLInputElement).value);
    else if (ev.key === 'Escape') { this.editingAddress.set(false); this.focusList(); }
  }

  async crumbMenu(ev: MouseEvent, path: string) {
    ev.stopPropagation();
    const r = ev.currentTarget as HTMLElement, rect = r.getBoundingClientRect();
    if (path === PC) {
      const items: MenuItem[] = this.state.drives().map(d => ({ label: this.state.driveName(d.letter), icon: 'drive', run: () => this.go(d.path) }));
      this.menu.set({ x: rect.left, y: rect.bottom + 4, items });
      return;
    }
    const list = await bridge.list(path);
    const dirs = list.entries.filter(e => e.dir && (this.s().showHidden || !e.hidden)).sort((a, b) => naturalCompare(a.name, b.name));
    const items: MenuItem[] = dirs.length ? dirs.map(d => ({ label: d.name, icon: 'folder', run: () => this.go(d.path), checked: isInside(this.tab().path(), d.path) })) : [{ label: t('list.noFolders'), disabled: true }];
    this.menu.set({ x: rect.left, y: rect.bottom + 4, items });
  }

  onSearchInput(value: string) {
    this.searchText.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.tab().search(value), value.trim() ? 300 : 0);
  }
  searchKey(ev: KeyboardEvent) {
    ev.stopPropagation();
    if (ev.key === 'Escape') { this.clearSearch(); this.focusList(); }
    else if (ev.key === 'Enter') { clearTimeout(this.searchTimer); this.tab().search(this.searchText()); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); this.focusList(); if (this.visible().length) this.tab().setSelection([this.visible()[0].path]); }
  }
  clearSearch() { clearTimeout(this.searchTimer); this.searchText.set(''); this.tab().clearSearch(); }


  focusList() { queueMicrotask(() => this.viewport()?.nativeElement.focus({ preventScroll: true })); }

  itemDown(ev: MouseEvent, e: Entry) {
    if (ev.button === 1) { ev.preventDefault(); if (e.dir) this.state.newTab(e.path, false); return; }
    if (ev.button !== 0 && ev.button !== 2) return;
    this.focusList();
    const tab = this.tab();
    const sel = tab.selected();
    if (ev.button === 2) { if (!sel.has(e.path)) tab.setSelection([e.path]); return; }
    if (ev.shiftKey) { this.selectRange(e.path, ev.ctrlKey); return; }
    if (ev.ctrlKey) { const next = new Set(sel); if (next.has(e.path)) next.delete(e.path); else next.add(e.path); tab.selected.set(next); tab.focus.set(e.path); tab.anchor = e.path; return; }
    if (sel.has(e.path)) { this.clickDefer = e.path; tab.focus.set(e.path); return; }
    tab.setSelection([e.path]);
  }
  itemClick(ev: MouseEvent, e: Entry) {
    if (this.clickDefer === e.path && !ev.ctrlKey && !ev.shiftKey) this.tab().setSelection([e.path]);
    this.clickDefer = null;
  }
  private selectRange(to: string, add: boolean) {
    const list = this.visible(), tab = this.tab();
    const a = list.findIndex(x => x.path === (tab.anchor ?? to)), b = list.findIndex(x => x.path === to);
    if (b < 0) return;
    const [lo, hi] = a < 0 ? [b, b] : [Math.min(a, b), Math.max(a, b)];
    const paths = list.slice(lo, hi + 1).map(x => x.path);
    const next = add ? new Set([...tab.selected(), ...paths]) : new Set(paths);
    tab.selected.set(next);
    tab.focus.set(to);
  }
  selectAll() { const tab = this.tab(); tab.selected.set(new Set(this.visible().map(e => e.path))); }
  selectNone() { this.tab().selected.set(new Set()); }
  invertSelection() { const sel = this.tab().selected(); this.tab().selected.set(new Set(this.visible().filter(e => !sel.has(e.path)).map(e => e.path))); }

  private ensureVisible(i: number) {
    const vp = this.viewport()?.nativeElement;
    if (!vp) return;
    const h = this.rowH(), pad = this.grid() ? GRID_PAD : 0;
    const top = pad + Math.floor(i / this.cols()) * h;
    if (top < vp.scrollTop) vp.scrollTop = top - pad;
    else if (top + h > vp.scrollTop + vp.clientHeight) vp.scrollTop = top + h - vp.clientHeight + pad;
  }

  private moveFocus(delta: number, ev: KeyboardEvent) {
    const list = this.visible();
    if (!list.length) return;
    const tab = this.tab();
    const cur = list.findIndex(e => e.path === tab.focus());
    const i = cur < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, cur + delta));
    const path = list[i].path;
    if (ev.shiftKey) this.selectRange(path, ev.ctrlKey);
    else if (ev.ctrlKey) tab.focus.set(path);
    else tab.setSelection([path]);
    this.ensureVisible(i);
  }

  bgDown(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (target.closest('.item, .rename-input')) return;
    this.focusList();
    if (ev.button !== 0) { if (ev.button === 2 && !ev.ctrlKey) this.selectNone(); return; }
    const vp = this.viewport()!.nativeElement;
    if (ev.offsetX > vp.clientWidth) return;
    const rect = vp.getBoundingClientRect();
    const x0 = ev.clientX - rect.left + vp.scrollLeft, y0 = ev.clientY - rect.top + vp.scrollTop;
    const base = ev.ctrlKey || ev.shiftKey ? new Set(this.tab().selected()) : new Set<string>();
    if (!ev.ctrlKey && !ev.shiftKey) this.selectNone();
    let moved = false, lastY = ev.clientY, lastX = ev.clientX;
    let timer: any = null;
    const update = () => {
      const x1 = lastX - rect.left + vp.scrollLeft, y1 = lastY - rect.top + vp.scrollTop;
      const m = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
      if (!moved && m.w + m.h < 5) return;
      moved = true;
      this.zone.run(() => { this.marquee.set(m); this.selectInRect(m, base); });
    };
    const move = (e: MouseEvent) => { lastX = e.clientX; lastY = e.clientY; update(); };
    const scrollLoop = () => {
      const r = vp.getBoundingClientRect();
      if (lastY < r.top + 4) vp.scrollTop -= 18; else if (lastY > r.bottom - 4) vp.scrollTop += 18; else return;
      update();
    };
    timer = setInterval(scrollLoop, 30);
    const up = () => { window.removeEventListener('mousemove', move, true); window.removeEventListener('mouseup', up, true); clearInterval(timer); this.zone.run(() => this.marquee.set(null)); };
    this.zone.runOutsideAngular(() => { window.addEventListener('mousemove', move, true); window.addEventListener('mouseup', up, true); });
  }
  private selectInRect(m: { x: number; y: number; w: number; h: number }, base: Set<string>) {
    const list = this.visible(), next = new Set(base);
    if (this.grid()) {
      const { w, h } = this.tile(), cols = this.cols();
      const c0 = Math.max(0, Math.floor((m.x - GRID_PAD) / w)), c1 = Math.min(cols - 1, Math.floor((m.x + m.w - GRID_PAD) / w));
      const r0 = Math.max(0, Math.floor((m.y - GRID_PAD) / h)), r1 = Math.floor((m.y + m.h - GRID_PAD) / h);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const e = list[r * cols + c]; if (e) next.add(e.path); }
    } else {
      const r0 = Math.max(0, Math.floor(m.y / ROW)), r1 = Math.min(list.length - 1, Math.floor((m.y + m.h) / ROW));
      for (let r = r0; r <= r1; r++) next.add(list[r].path);
    }
    this.tab().selected.set(next);
  }


  onKey(ev: KeyboardEvent) {
    if (!this.active() || ev.defaultPrevented) return;
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (this.dialog()) { if (ev.key === 'Escape') { this.closeDialog(); ev.preventDefault(); } return; }
    if (this.menu()) { if (ev.key === 'Escape') { this.menu.set(null); ev.preventDefault(); } return; }
    const k = ev.key, ctrl = ev.ctrlKey && !ev.altKey, tab = this.tab();
    const step = this.grid() ? this.cols() : 1;
    const page = Math.max(1, Math.floor(this.viewH() / this.rowH()) - 1) * this.cols();
    let handled = true;
    if (k === 'ArrowDown') this.moveFocus(step, ev);
    else if (k === 'ArrowUp' && ev.altKey) tab.up();
    else if (k === 'ArrowUp') this.moveFocus(-step, ev);
    else if (k === 'ArrowRight' && ev.altKey) tab.forward();
    else if (k === 'ArrowLeft' && ev.altKey) tab.back();
    else if (k === 'ArrowRight' && this.grid()) this.moveFocus(1, ev);
    else if (k === 'ArrowLeft' && this.grid()) this.moveFocus(-1, ev);
    else if (k === 'PageDown') this.moveFocus(page, ev);
    else if (k === 'PageUp') this.moveFocus(-page, ev);
    else if (k === 'Home') this.moveFocus(-1e9, ev);
    else if (k === 'End') this.moveFocus(1e9, ev);
    else if (k === 'Enter' && ev.altKey) this.showProperties();
    else if (k === 'Enter') this.openSelection();
    else if (k === 'Backspace') tab.up();
    else if (k === 'BrowserBack') tab.back();
    else if (k === 'BrowserForward') tab.forward();
    else if (k === 'F2') this.startRename();
    else if (k === 'F5' || (ctrl && k.toLowerCase() === 'r')) this.refresh();
    else if (k === 'Delete') this.askDelete(ev.shiftKey);
    else if (k === 'F4' || (ctrl && k.toLowerCase() === 'l') || (ev.altKey && k.toLowerCase() === 'd')) this.startAddressEdit();
    else if (k === 'F3' || (ctrl && k.toLowerCase() === 'f') || (ctrl && k.toLowerCase() === 'e')) this.searchInput()?.nativeElement.focus();
    else if (k === 'Escape') { if (this.searching()) this.clearSearch(); else this.selectNone(); }
    else if (ctrl && ev.shiftKey && k.toLowerCase() === 'n') this.newFolder();
    else if (ctrl && ev.shiftKey && k.toLowerCase() === 'c') this.copyPath();
    else if (ctrl && k.toLowerCase() === 'a') this.selectAll();
    else if (ctrl && k.toLowerCase() === 'c') this.copy('copy');
    else if (ctrl && k.toLowerCase() === 'x') this.copy('move');
    else if (ctrl && k.toLowerCase() === 'v') this.paste();
    else if (k === 'ContextMenu' || (ev.shiftKey && k === 'F10')) { const el = this.host.nativeElement.querySelector('.item--focus') as HTMLElement | null; const r = (el ?? this.viewport()!.nativeElement).getBoundingClientRect(); this.openContext(r.left + 24, r.top + 20, this.single()); }
    else if (k.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) this.typeAhead(k);
    else handled = false;
    if (handled) { ev.preventDefault(); ev.stopPropagation(); }
  }
  private typeAhead(ch: string) {
    const now = Date.now();
    this.typed = now - this.typedAt > 900 ? ch.toLowerCase() : this.typed + ch.toLowerCase();
    this.typedAt = now;
    const list = this.visible(), cur = list.findIndex(e => e.path === this.tab().focus());
    const repeat = this.typed.length > 1 && [...this.typed].every(c => c === this.typed[0]);
    const prefix = repeat ? this.typed[0] : this.typed;
    const start = repeat || this.typed.length === 1 ? cur + 1 : Math.max(0, cur);
    for (let k = 0; k < list.length; k++) {
      const i = (start + k) % list.length;
      if (list[i].name.toLowerCase().startsWith(prefix)) { this.tab().setSelection([list[i].path]); this.ensureVisible(i); return; }
    }
  }


  get dir() { return this.tab().path(); }
  canWrite = computed(() => this.tab().path() !== PC && !this.searching());
  refresh() { this.tab().load(); if (this.tab().isPc()) this.state.refreshDrives(true); }

  async newFolder() {
    if (!this.canWrite()) return;
    const r = await bridge.mkdir(this.dir, t('ops.newFolderName'));
    if (!r.ok || !r.path) { this.state.toast(t('err.create', { error: r.error ?? '' }), 'error'); return; }
    await this.tab().load([r.path]);
    this.tab().renaming.set(r.path);
  }
  async newTextFile() {
    if (!this.canWrite()) return;
    const r = await bridge.newFile(this.dir, t('ops.newFileName'));
    if (!r.ok || !r.path) { this.state.toast(t('err.create', { error: r.error ?? '' }), 'error'); return; }
    await this.tab().load([r.path]);
    this.tab().renaming.set(r.path);
  }

  startRename() { const e = this.single() ?? this.selectedEntries()[0]; if (e) { this.tab().setSelection([e.path]); this.tab().renaming.set(e.path); } }
  private focusRename() {
    const el = this.host.nativeElement.querySelector('.rename-input') as HTMLInputElement | null;
    if (!el || document.activeElement === el) return;
    el.focus();
    const e = this.visible().find(x => x.path === this.tab().renaming());
    const end = e && !e.dir && this.s().showExtensions ? stem(e.name).length : el.value.length;
    el.setSelectionRange(0, end);
  }
  async commitRename(e: Entry, value: string) {
    if (this.tab().renaming() !== e.path) return;
    this.tab().renaming.set(null);
    let name = value.trim();
    if (!this.s().showExtensions && !e.dir && e.ext && name) name += '.' + e.name.slice(e.name.lastIndexOf('.') + 1);
    if (!name || name === e.name) { this.focusList(); return; }
    const bad = invalidName(name);
    if (bad) { this.state.toast(t(('err.name.' + bad) as TextKey), 'error'); this.focusList(); return; }
    const r = await bridge.rename(e.path, name);
    if (!r.ok) this.state.toast(r.error === 'exists' ? t('err.exists', { name }) : t('err.rename', { error: r.error ?? '' }), 'error');
    else { if (this.state.isPinned(e.path) && r.path) { this.state.unpin(e.path); this.state.pin(r.path); } await this.tab().load(r.path ? [r.path] : []); }
    this.focusList();
  }
  renameKey(ev: KeyboardEvent, e: Entry) {
    ev.stopPropagation();
    if (ev.key === 'Enter') this.commitRename(e, (ev.target as HTMLInputElement).value);
    else if (ev.key === 'Escape') { this.tab().renaming.set(null); this.focusList(); }
  }

  askDelete(permanent: boolean) {
    const paths = this.selectedEntries().map(e => e.path);
    if (!paths.length) return;
    if (permanent || this.s().confirmDelete) this.dialog.set({ kind: 'delete', paths, permanent });
    else this.doDelete(paths, false);
  }
  async doDelete(paths: string[], permanent: boolean) {
    this.dialog.set(null);
    const busy = paths.length > 3 ? this.state.toast(t('ops.deleting', { n: paths.length }), 'busy') : 0;
    const r = permanent ? await bridge.remove(paths) : await bridge.trash(paths);
    if (busy) this.state.dismiss(busy);
    if (!r.ok) this.state.toast(t('err.delete', { error: r.error ?? '' }), 'error');
    else for (const p of paths) if (this.state.isPinned(p)) this.state.unpin(p);
    await this.tab().load();
    this.focusList();
  }

  copy(mode: 'copy' | 'move') {
    const paths = this.selectedEntries().map(e => e.path);
    if (!paths.length) return;
    this.state.setClip(paths, mode);
    this.state.toast(t(mode === 'copy' ? 'ops.copied' : 'ops.cut', { n: paths.length }));
  }
  copyPath() {
    const list = this.selectedEntries();
    const text = list.length ? list.map(e => `"${e.path}"`).join('\r\n') : this.dir === PC ? '' : `"${this.dir}"`;
    if (!text) return;
    bridge.writeClipboardText(list.length === 1 || !list.length ? text.replace(/^"|"$/g, '') : text);
    this.state.toast(t('ops.pathCopied'));
  }
  async paste(into?: string) {
    const dest = into ?? this.dir;
    if (!dest || dest === PC || (!into && this.searching())) return;
    const clip = await this.state.readClip();
    if (!clip?.paths.length) return;
    await this.transfer(clip.paths, dest, clip.mode, clip);
  }

  async transfer(sources: string[], dest: string, mode: 'copy' | 'move', clip?: Clip) {
    if (sources.some(src => isInside(dest, src) && !samePath(parentOf(src) ?? '', dest))) { this.state.toast(t('err.inside'), 'error'); return; }
    let conflict: Conflict = 'ask';
    let busy = 0;
    const timer = setTimeout(() => busy = this.state.toast(t(mode === 'copy' ? 'ops.copying' : 'ops.moving', { n: sources.length }), 'busy'), 400);
    try {
      for (;;) {
        const r = await bridge.transfer({ sources, dest, mode, conflict });
        if (r.conflicts?.length) {
          clearTimeout(timer); if (busy) { this.state.dismiss(busy); busy = 0; }
          const choice = await new Promise<Conflict | null>(resolve => this.dialog.set({ kind: 'conflict', names: r.conflicts!, resolve }));
          this.dialog.set(null);
          if (!choice) return;
          conflict = choice;
          busy = this.state.toast(t(mode === 'copy' ? 'ops.copying' : 'ops.moving', { n: sources.length }), 'busy');
          continue;
        }
        if (r.failed.length) this.state.toast(t('err.transfer', { n: r.failed.length, error: r.failed[0].error === 'inside' ? t('err.inside') : r.failed[0].error }), 'error');
        if (clip) this.state.clipDone(clip);
        if (samePath(dest, this.dir)) await this.tab().load(r.created);
        else await this.tab().load();
        return;
      }
    } finally { clearTimeout(timer); if (busy) this.state.dismiss(busy); }
  }


  dragStart(ev: DragEvent, e: Entry) {
    ev.preventDefault();
    if (!this.tab().selected().has(e.path)) this.tab().setSelection([e.path]);
    this.clickDefer = null;
    bridge.startDrag(this.selectedEntries().map(x => x.path));
  }
  private dropMode(ev: DragEvent, sources: string[], dest: string): 'copy' | 'move' {
    if (ev.ctrlKey) return 'copy';
    if (ev.shiftKey) return 'move';
    const drive = (p: string) => p.slice(0, 2).toLowerCase();
    return sources.every(s => drive(s) === drive(dest)) ? 'move' : 'copy';
  }
  dragOver(ev: DragEvent, dest: string | null) {
    if (!ev.dataTransfer?.types.includes('Files') || !dest || dest === PC) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.dataTransfer.dropEffect = ev.ctrlKey ? 'copy' : ev.shiftKey ? 'move' : 'move';
    if (this.dropTarget() !== dest) this.dropTarget.set(dest);
  }
  dragLeave(ev: DragEvent) { if (!(ev.currentTarget as HTMLElement).contains(ev.relatedTarget as Node)) this.dropTarget.set(null); }
  async drop(ev: DragEvent, dest: string | null) {
    this.dropTarget.set(null);
    if (!ev.dataTransfer?.files.length || !dest || dest === PC) return;
    ev.preventDefault();
    ev.stopPropagation();
    const sources = Array.from(ev.dataTransfer.files).map(f => bridge.pathForFile(f)).filter(Boolean);
    if (!sources.length) return;
    const mode = this.dropMode(ev, sources, dest);
    if (mode === 'move' && sources.every(s => samePath(parentOf(s) ?? '', dest))) return;
    if (sources.some(s => samePath(s, dest))) return;
    await this.transfer(sources, dest, mode);
  }


  sortBy(key: SortKey) {
    const s = this.s();
    if (s.sortKey === key) this.state.saveSettings({ sortDir: -s.sortDir });
    else this.state.saveSettings({ sortKey: key, sortDir: key === 'mtime' || key === 'size' ? -1 : 1 });
  }
  setView(view: 'details' | 'grid', iconSize?: 'small' | 'medium' | 'large') { this.state.saveSettings(iconSize ? { view, iconSize } : { view }); }

  sidebarResize(ev: MouseEvent) {
    ev.preventDefault();
    const startX = ev.clientX, startW = this.s().sidebarWidth;
    const el = (this.host.nativeElement as HTMLElement).querySelector('.body') as HTMLElement;
    this.resizing.set(true);
    let w = startW;
    const move = (e: MouseEvent) => { w = Math.min(480, Math.max(160, startW + e.clientX - startX)); el.style.setProperty('--sidebar', w + 'px'); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); this.zone.run(() => { this.resizing.set(false); this.state.saveSettings({ sidebarWidth: w }); }); };
    this.zone.runOutsideAngular(() => { window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); });
  }


  newMenu(ev: MouseEvent) { const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); this.menu.set({ x: r.left, y: r.bottom + 4, items: this.newItems() }); }
  private newItems(): MenuItem[] { return [{ label: t('ops.newFolder'), icon: 'newFolder', run: () => this.newFolder(), disabled: !this.canWrite() }, { label: t('ops.newFile'), icon: 'newFile', run: () => this.newTextFile(), disabled: !this.canWrite() }]; }
  sortMenu(ev: MouseEvent) { const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); this.menu.set({ x: r.left, y: r.bottom + 4, items: this.sortItems() }); }
  private sortItems(): MenuItem[] {
    const s = this.s();
    const keys: [SortKey, TextKey][] = [['name', 'col.name'], ['mtime', 'col.modified'], ['type', 'col.type'], ['size', 'col.size']];
    return [
      ...keys.map(([k, label]) => ({ label: t(label), checked: s.sortKey === k, run: () => this.state.saveSettings({ sortKey: k }) })),
      { sep: true },
      { label: t('sort.asc'), checked: s.sortDir > 0, run: () => this.state.saveSettings({ sortDir: 1 }) },
      { label: t('sort.desc'), checked: s.sortDir < 0, run: () => this.state.saveSettings({ sortDir: -1 }) },
      { sep: true },
      { label: t('sort.foldersFirst'), checked: s.foldersFirst, run: () => this.state.saveSettings({ foldersFirst: !s.foldersFirst }) },
    ];
  }
  viewMenu(ev: MouseEvent) {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(), s = this.s();
    this.menu.set({ x: r.left, y: r.bottom + 4, items: [
      { label: t('view.large'), icon: 'grid', checked: s.view === 'grid' && s.iconSize === 'large', run: () => this.setView('grid', 'large') },
      { label: t('view.medium'), icon: 'grid', checked: s.view === 'grid' && s.iconSize === 'medium', run: () => this.setView('grid', 'medium') },
      { label: t('view.small'), icon: 'grid', checked: s.view === 'grid' && s.iconSize === 'small', run: () => this.setView('grid', 'small') },
      { label: t('view.details'), icon: 'list', checked: s.view === 'details', run: () => this.setView('details') },
      { sep: true },
      { label: t('view.preview'), icon: 'panel', checked: s.preview, run: () => this.state.saveSettings({ preview: !s.preview }) },
      { label: t('view.hidden'), icon: 'eye', checked: s.showHidden, run: () => this.state.saveSettings({ showHidden: !s.showHidden }) },
      { label: t('view.extensions'), icon: 'documents', checked: s.showExtensions, run: () => this.state.saveSettings({ showExtensions: !s.showExtensions }) },
    ] });
  }
  moreMenu(ev: MouseEvent) {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const here = this.dir !== PC;
    this.menu.set({ x: Math.min(r.left, window.innerWidth - 260), y: r.bottom + 4, items: [
      { label: t('menu.selectAll'), icon: 'selectAll', run: () => this.selectAll() },
      { label: t('menu.selectNone'), icon: 'close', run: () => this.selectNone() },
      { label: t('menu.invert'), icon: 'refresh', run: () => this.invertSelection() },
      { sep: true },
      { label: this.terminalLabel(), icon: 'terminal', run: () => bridge.openTerminal(this.dir), disabled: !here },
      { label: t('menu.vscode'), icon: 'code', run: () => bridge.openVsCode(this.dir), disabled: !here || !this.state.info()?.vscode },
      { label: t('menu.explorer'), icon: 'explorer', run: () => bridge.showInExplorer(here ? this.dir : 'shell:MyComputerFolder', false) },
      { sep: true },
      { label: t('menu.properties'), icon: 'info', run: () => this.showProperties(), disabled: !here && !this.single() },
      { label: t('common.settings'), icon: 'gear', run: () => this.state.openSettings() },
    ] });
  }
  terminalLabel() { const k = this.state.info()?.terminal; return t(k === 'dhterminal' ? 'menu.dhterminal' : 'menu.terminal'); }

  itemContext(ev: MouseEvent, e: Entry) { ev.preventDefault(); ev.stopPropagation(); if (!this.tab().selected().has(e.path)) this.tab().setSelection([e.path]); this.openContext(ev.clientX, ev.clientY, e); }
  bgContext(ev: MouseEvent) { ev.preventDefault(); if (!(ev.target as HTMLElement).closest('.item')) { this.selectNone(); this.openContext(ev.clientX, ev.clientY, null); } }

  private openContext(x: number, y: number, e: Entry | null) {
    const list = this.selectedEntries();
    const items: MenuItem[] = [];
    if (e && list.length) {
      const one = list.length === 1 ? list[0] : null;
      items.push({ label: t('menu.open'), icon: 'external', run: () => this.openSelection() });
      if (one?.dir) items.push({ label: t('menu.openTab'), icon: 'plus', run: () => this.state.newTab(one.path, false) }, { label: t('menu.openWindow'), icon: 'window', run: () => bridge.newWindow(one.path) });
      if (one && !one.dir) { this.loadApps(one); items.push({ label: t('menu.openWith'), icon: 'openWith', sub: () => this.openWithItems(one) }); }
      if (this.searching() && one) items.push({ label: t('menu.openLocation'), icon: 'folder', run: () => this.tab().go(one.parent ?? parentOf(one.path) ?? PC, { select: one.path }) });
      items.push({ sep: true },
        { label: t('menu.cut'), icon: 'cut', run: () => this.copy('move') },
        { label: t('menu.copy'), icon: 'copy', run: () => this.copy('copy') });
      if (one?.dir) items.push({ label: t('menu.pasteInto'), icon: 'paste', run: () => this.paste(one.path) });
      items.push({ label: t('menu.copyPath'), icon: 'link', run: () => this.copyPath() },
        { sep: true },
        { label: t('menu.rename'), icon: 'edit', run: () => this.startRename(), disabled: !one },
        { label: t('menu.delete'), icon: 'trash', run: () => this.askDelete(false), danger: true });
      if (one?.dir) {
        items.push({ sep: true },
          this.state.isPinned(one.path) ? { label: t('menu.unpin'), icon: 'unpin', run: () => this.state.unpin(one.path) } : { label: t('menu.pin'), icon: 'pin', run: () => this.state.pin(one.path) },
          { label: this.terminalLabel(), icon: 'terminal', run: () => bridge.openTerminal(one.path) });
        if (this.state.info()?.vscode) items.push({ label: t('menu.vscode'), icon: 'code', run: () => bridge.openVsCode(one.path) });
      } else if (one && this.state.info()?.vscode && isTextFile(one.ext)) items.push({ sep: true }, { label: t('menu.vscode'), icon: 'code', run: () => bridge.openVsCode(one.path) });
      items.push({ sep: true },
        { label: t('menu.showInExplorer'), icon: 'explorer', run: () => bridge.showInExplorer(list[0].path, true) },
        { label: t('menu.properties'), icon: 'info', run: () => this.showProperties(), disabled: !one });
    } else {
      const here = this.dir !== PC;
      if (!here) { items.push({ label: t('menu.refresh'), icon: 'refresh', run: () => this.refresh() }); }
      else {
        items.push(...this.newItems(), { sep: true },
          { label: t('menu.paste'), icon: 'paste', run: () => this.paste(), disabled: this.searching() },
          { label: t('menu.refresh'), icon: 'refresh', run: () => this.refresh() },
          { sep: true }, ...this.sortItems().slice(0, 4),
          { sep: true },
          { label: t('view.hidden'), icon: 'eye', checked: this.s().showHidden, run: () => this.state.saveSettings({ showHidden: !this.s().showHidden }) },
          { sep: true },
          { label: this.terminalLabel(), icon: 'terminal', run: () => bridge.openTerminal(this.dir) });
        if (this.state.info()?.vscode) items.push({ label: t('menu.vscode'), icon: 'code', run: () => bridge.openVsCode(this.dir) });
        items.push({ label: t('menu.explorer'), icon: 'explorer', run: () => bridge.showInExplorer(this.dir, false) },
          { sep: true },
          this.state.isPinned(this.dir) ? { label: t('menu.unpin'), icon: 'unpin', run: () => this.state.unpin(this.dir) } : { label: t('menu.pin'), icon: 'pin', run: () => this.state.pin(this.dir) },
          { label: t('menu.properties'), icon: 'info', run: () => this.showProperties(this.dir) });
      }
    }
    const height = items.reduce((h, i) => h + (i.sep ? 9 : 34), 12);
    this.menu.set({ x: Math.max(4, Math.min(x, window.innerWidth - 260)), y: Math.max(4, Math.min(y, window.innerHeight - height - 8)), items });
  }
  runMenu(item: MenuItem, ev?: Event, index = -1) {
    if (item.disabled) return;
    if (item.sub) { if (ev) this.openSub(ev, index); return; }
    this.menu.set(null);
    item.run?.();
  }
  hoverMenu(ev: Event, item: MenuItem, index: number) {
    clearTimeout(this.subTimer);
    if (item.sub && !item.disabled) this.openSub(ev, index);
    else if (this.sub()) this.subTimer = setTimeout(() => this.sub.set(null), 250);
  }
  keepSub() { clearTimeout(this.subTimer); }
  private openSub(ev: Event, index: number) {
    const button = ev.currentTarget as HTMLElement, menu = button.closest('.menu') as HTMLElement;
    const r = button.getBoundingClientRect(), m = menu.getBoundingClientRect();
    if (this.sub()?.index !== index) this.sub.set({ index, x: m.right - 4, y: r.top - 6, left: m.left });
  }
  private loadApps(e: Entry) {
    if (this.apps()?.path === e.path && this.apps()!.list) return;
    this.apps.set({ path: e.path, list: null });
    bridge.openWithApps(e.path, iconSize(18)).then(list => { if (this.apps()?.path === e.path) this.apps.set({ path: e.path, list }); }, () => this.apps.set({ path: e.path, list: [] }));
  }
  private openWithItems(e: Entry): MenuItem[] {
    const state = this.apps();
    const list = state?.path === e.path ? state.list : null;
    const items: MenuItem[] = [];
    if (!list) items.push({ label: t('menu.loadingApps'), icon: 'refresh', disabled: true });
    else for (const app of list) items.push({
      label: app.label,
      img: app.img ? `data:image/png;base64,${app.img}` : app.icon ? nativeIconUrl(app.icon, 18) : undefined,
      icon: app.img || app.icon ? undefined : 'openWith',
      note: app.isDefault ? t('menu.default') : undefined,
      run: () => bridge.openWithApp(e.path, app.id),
    });
    if (list?.length) items.push({ sep: true });
    items.push({ label: t('menu.chooseApp'), icon: 'openWith', run: () => bridge.openWith(e.path) });
    return items;
  }
  placeContext(ev: MouseEvent, path: string, pinned: boolean) {
    ev.preventDefault();
    const items: MenuItem[] = [
      { label: t('menu.openTab'), icon: 'plus', run: () => this.state.newTab(path, false) },
      { label: t('menu.openWindow'), icon: 'window', run: () => bridge.newWindow(path) },
      { sep: true },
      pinned || this.state.isPinned(path) ? { label: t('menu.unpin'), icon: 'unpin', run: () => this.state.unpin(path) } : { label: t('menu.pin'), icon: 'pin', run: () => this.state.pin(path) },
      ...(pinned ? [
        { label: t('menu.moveUp'), icon: 'up', run: () => this.state.movePin(path, -1), disabled: samePath(this.pinned()[0] ?? '', path) },
        { label: t('menu.moveDown'), icon: 'down', run: () => this.state.movePin(path, 1), disabled: samePath(this.pinned()[this.pinned().length - 1] ?? '', path) },
      ] : []),
      { sep: true },
      { label: this.terminalLabel(), icon: 'terminal', run: () => bridge.openTerminal(path) },
      { label: t('menu.properties'), icon: 'info', run: () => this.showProperties(path) },
    ];
    this.menu.set({ x: ev.clientX, y: Math.min(ev.clientY, window.innerHeight - items.reduce((h, i) => h + (i.sep ? 9 : 34), 20)), items });
  }
  pinLabel(p: string) { return p.length <= 3 ? this.state.driveName(p.slice(0, 2)) : (this.state.specialOf(p) ? this.placeLabel(this.state.specialOf(p)!) : baseName(p)); }
  pinDragOver(ev: DragEvent) {
    if (!ev.dataTransfer?.types.includes('Files')) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'link';
    this.dropTarget.set('pin:');
  }
  async dropPin(ev: DragEvent) {
    this.dropTarget.set(null);
    if (!ev.dataTransfer?.files.length) return;
    ev.preventDefault();
    for (const f of Array.from(ev.dataTransfer.files)) {
      const r = await bridge.resolve(bridge.pathForFile(f));
      if (r?.dir) this.state.pin(r.path);
    }
  }

  showSection(id: SideSection) { return !this.s().hiddenSections.includes(id); }
  private sectionLabel(id: SideSection) { return t(('side.' + id) as TextKey); }
  setSection(id: SideSection, show: boolean) {
    const hidden = this.s().hiddenSections.filter(x => x !== id);
    this.state.saveSettings({ hiddenSections: show ? hidden : [...hidden, id] });
  }
  sideContext(ev: MouseEvent, id: SideSection | null) {
    if (ev.defaultPrevented) return;
    ev.preventDefault();
    if (!id && (ev.target as HTMLElement).closest('.side-item, .side-twist')) return;
    const hidden = this.s().hiddenSections;
    const items: MenuItem[] = [];
    if (id) items.push({ label: t('side.hide', { name: this.sectionLabel(id) }), icon: 'hidden', run: () => this.setSection(id, false) }, { sep: true });
    items.push(...SIDE_SECTIONS.map(x => ({ label: this.sectionLabel(x), checked: !hidden.includes(x), run: () => this.setSection(x, hidden.includes(x)) })));
    if (hidden.length) items.push({ sep: true }, { label: t('side.showAll'), icon: 'eye', run: () => this.state.saveSettings({ hiddenSections: [] }) });
    this.showMenuAt(ev, items);
  }
  toggleDrives() { this.state.saveSettings({ drivesCollapsed: !this.s().drivesCollapsed }); }
  pcContext(ev: MouseEvent) {
    ev.preventDefault();
    const collapsed = this.s().drivesCollapsed;
    this.showMenuAt(ev, [
      { label: t('menu.openTab'), icon: 'plus', run: () => this.state.newTab(PC, false) },
      { label: t('menu.openWindow'), icon: 'window', run: () => bridge.newWindow(PC) },
      { sep: true },
      { label: t(collapsed ? 'side.expand' : 'side.collapse'), icon: collapsed ? 'down' : 'up', run: () => this.toggleDrives() },
    ]);
  }
  private showMenuAt(ev: MouseEvent, items: MenuItem[]) {
    const height = items.reduce((h, i) => h + (i.sep ? 9 : 34), 20);
    this.menu.set({ x: Math.max(4, Math.min(ev.clientX, window.innerWidth - 260)), y: Math.max(4, Math.min(ev.clientY, window.innerHeight - height)), items });
  }

  placeMouse(ev: MouseEvent, path: string) { if (ev.button === 1) { ev.preventDefault(); this.state.newTab(path, false); } }


  async showProperties(path?: string) {
    const entry = path ? null : this.single();
    const target = path ?? entry?.path ?? (this.dir !== PC ? this.dir : null);
    if (!target) return;
    const id = 'p' + propSeq++;
    this.dialog.set({ kind: 'props', id, props: null, entry, path: target });
    const off = bridge.on('props:update', ({ id: pid, props }) => this.zone.run(() => { const d = this.dialog(); if (d?.kind === 'props' && d.id === pid) this.dialog.set({ ...d, props }); }));
    const props = await bridge.properties(id, target);
    off();
    const d = this.dialog();
    if (d?.kind === 'props' && d.id === id) {
      if (!props) { this.dialog.set(null); this.state.toast(t('err.props'), 'error'); }
      else this.dialog.set({ ...d, props });
    }
  }
  async toggleReadonly(p: Properties) {
    const r = await bridge.setReadonly(p.path, !p.readonly);
    if (!r.ok) { this.state.toast(t('err.attr', { error: r.error ?? '' }), 'error'); return; }
    const d = this.dialog();
    if (d?.kind === 'props') this.dialog.set({ ...d, props: { ...p, readonly: !p.readonly } });
  }
  propsKind(d: { entry: Entry | null; props: Properties | null; path: string }): string {
    if (d.entry) return this.typeLabel(d.entry);
    if (/^[A-Z]:\\$/i.test(d.path)) return t('kind.drive');
    return d.props && !d.props.dir ? this.typeLabel({ dir: false, ext: d.props.name.split('.').pop() ?? '' } as Entry) : t('kind.folder');
  }
  closeDialog() {
    const d = this.dialog();
    if (d?.kind === 'conflict') d.resolve(null);
    if (d?.kind === 'props') bridge.cancelProperties(d.id);
    this.dialog.set(null);
    this.focusList();
  }

  parentName(e: Entry) { return e.parent ?? parentOf(e.path) ?? ''; }
  canThumb(e: Entry) { return hasThumbnail(e); }
  bridgeTerminal() { bridge.openTerminal(this.dir); }
  bridgeRecycle() { bridge.openRecycleBin(); }
  bridgeExplorer(path: string) { bridge.showInExplorer(path, true); }
}