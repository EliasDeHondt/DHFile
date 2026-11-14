import { signal, computed } from '@angular/core';
import { baseName, normalizePath, parentOf, PC, samePath } from '../../shared/files';
import { Entry } from '../../shared/types';
import { bridge } from './bridge';

let nextToken = 1;

export class FolderTab {
  readonly kind = 'folder' as const;
  readonly path = signal('');
  readonly entries = signal<Entry[]>([]);
  readonly loading = signal(false);
  readonly error = signal<{ code: string; message: string } | null>(null);
  readonly history = signal<string[]>([]);
  readonly index = signal(-1);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly focus = signal<string | null>(null);
  readonly renaming = signal<string | null>(null);
  readonly query = signal('');
  readonly results = signal<Entry[] | null>(null);
  readonly searching = signal(false);
  anchor: string | null = null;
  scrollTo: string | null = null;
  private loadSeq = 0;
  private token: string | null = null;

  readonly canBack = computed(() => this.index() > 0);
  readonly canForward = computed(() => this.index() < this.history().length - 1);
  readonly canUp = computed(() => this.path() !== PC && parentOf(this.path()) !== null);
  readonly isPc = computed(() => this.path() === PC);

  constructor(readonly id: number, private onLoaded: (tab: FolderTab) => void) {}

  async go(path: string, opts: { push?: boolean; select?: string | null } = {}) {
    const target = path === PC ? PC : normalizePath(path);
    this.stopSearch();
    if (opts.push !== false && (this.history()[this.index()] ?? '') !== target) {
      const h = this.history().slice(0, this.index() + 1);
      h.push(target);
      this.history.set(h.slice(-200));
      this.index.set(this.history().length - 1);
    }
    const from = this.path();
    this.path.set(target);
    this.renaming.set(null);
    const select = opts.select !== undefined ? opts.select : (from && from !== PC && parentOf(from) === target ? from : null);
    await this.load(select ? [select] : []);
  }

  back() { if (this.canBack()) { const from = this.path(); this.index.update(i => i - 1); this.go(this.history()[this.index()], { push: false, select: parentOf(from) === this.history()[this.index()] ? from : null }); } }
  forward() { if (this.canForward()) { this.index.update(i => i + 1); this.go(this.history()[this.index()], { push: false }); } }
  up() { const p = parentOf(this.path()); if (p) this.go(p, { select: this.path() }); }

  async load(select: string[] = []) {
    const path = this.path();
    const seq = ++this.loadSeq;
    bridge.watch(this.id, path === PC ? null : path);
    if (path === PC) { this.entries.set([]); this.error.set(null); this.loading.set(false); this.setSelection(select); this.onLoaded(this); return; }
    this.loading.set(true);
    const r = await bridge.list(path);
    if (seq !== this.loadSeq) return;
    this.loading.set(false);
    this.error.set(r.error ? { code: r.code ?? '', message: r.error } : null);
    this.entries.set(r.entries);
    this.setSelection(select.length ? select : [...this.selected()].filter(p => r.entries.some(e => e.path === p)));
    this.onLoaded(this);
  }

  async refresh() { if (!this.results()) await this.load(); }

  setSelection(paths: string[], focus: string | null = paths[paths.length - 1] ?? null) {
    this.selected.set(new Set(paths));
    this.focus.set(focus);
    if (paths.length === 1) this.anchor = paths[0];
    if (focus) this.scrollTo = focus;
  }

  title(labels: { pc: string; drive: (letter: string) => string; home: string; user: string }): string {
    const p = this.path();
    if (!p) return '';
    if (p === PC) return labels.pc;
    if (/^[A-Z]:\\$/i.test(p)) return labels.drive(p.slice(0, 2));
    if (samePath(p, labels.home)) return labels.user;
    return baseName(p);
  }

  search(query: string) {
    this.stopSearch();
    this.query.set(query);
    if (!query.trim() || this.path() === PC) { this.results.set(null); return; }
    const token = String(nextToken++);
    this.token = token;
    this.results.set([]);
    this.searching.set(true);
    this.selected.set(new Set());
    bridge.search(token, this.path(), query.trim());
  }
  onResults(token: string, entries: Entry[], done: boolean) {
    if (token !== this.token) return;
    if (entries.length) this.results.update(r => [...(r ?? []), ...entries]);
    if (done) { this.searching.set(false); this.token = null; }
  }
  stopSearch() {
    if (this.token) bridge.cancelSearch(this.token);
    this.token = null;
    this.searching.set(false);
  }
  clearSearch() { this.stopSearch(); this.query.set(''); this.results.set(null); }
  dispose() { this.stopSearch(); bridge.watch(this.id, null); }
}

export class SettingsTab {
  readonly kind = 'settings' as const;
  constructor(readonly id: number) {}
}

export type Tab = FolderTab | SettingsTab;
