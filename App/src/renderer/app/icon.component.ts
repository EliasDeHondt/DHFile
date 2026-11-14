import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { hasThumbnail, kindOf, wantsNativeIcon } from '../../shared/files';
import { Entry } from '../../shared/types';
import { bridge, nativeIconUrl, thumbUrl } from './bridge';
import { StateService } from './state.service';
import { driveIconSvg, fileIconSvg, folderIconSvg, FOLDER_PEEK_BACK, FOLDER_PEEK_FRONT, PC_ICON, RECYCLE_ICON, UI_ICONS } from './icons';

const cache = new Map<string, SafeHtml>();
function trusted(sanitizer: DomSanitizer, key: string, make: () => string) {
  let v = cache.get(key);
  if (!v) { v = sanitizer.bypassSecurityTrustHtml(make()); cache.set(key, v); }
  return v;
}

/* ---------- Folder peeks: a few files per folder, cached by path + folder mtime ---------- */

const peeks = new Map<string, Entry[]>();
const peeking = new Map<string, Promise<Entry[]>>();
const waiting: (() => void)[] = [];
let running = 0;
const PEEK_PARALLEL = 4;

function peekKey(e: Entry) { return e.path + '|' + Math.round(e.mtime); }
function loadPeek(e: Entry): Promise<Entry[]> {
  const key = peekKey(e);
  const busy = peeking.get(key);
  if (busy) return busy;
  const job = new Promise<void>(go => { if (running < PEEK_PARALLEL) { running++; go(); } else waiting.push(go); })
    .then(() => bridge.peek(e.path))
    .catch(() => [] as Entry[])
    .then(list => {
      const next = waiting.shift();
      if (next) next(); else running--;
      peeking.delete(key);
      if (peeks.size > 3000) peeks.delete(peeks.keys().next().value!);
      peeks.set(key, list);
      return list;
    });
  peeking.set(key, job);
  return job;
}

interface PeekItem { key: string; src: string | null; svg: SafeHtml | null; thumb: boolean; }

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ui-icon', 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 24 24" [innerHTML]="svg()"></svg>`,
  styles: [`:host { display: inline-flex; width: var(--icon-size, 16px); height: var(--icon-size, 16px); flex: none; } svg { width: 100%; height: 100%; display: block; }`],
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);
  name = input.required<string>();
  svg = computed(() => trusted(this.sanitizer, 'ui:' + this.name(), () => UI_ICONS[this.name()] ?? ''));
}

/** Folder, file, drive or PC icon. Shows a real thumbnail or the app's own Windows icon when that makes sense. */
@Component({
  selector: 'app-file-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'file-icon', 'aria-hidden': 'true' },
  template: `@if (peekItems(); as items) {
    <span class="peek">
      <svg class="peek-layer" viewBox="0 0 48 48" [innerHTML]="peekBack"></svg>
      @for (it of items; track it.key; let i = $index) {
        <span class="peek-card" [class.peek-card--thumb]="it.thumb" [attr.data-pos]="items.length + '-' + i">
          @if (it.src) { <img [src]="it.src" alt="" draggable="false" loading="lazy" (error)="peekFailed(it.key)"> } @else { <svg viewBox="0 0 48 48" [innerHTML]="it.svg"></svg> }
        </span>
      }
      <svg class="peek-layer peek-layer--front" viewBox="0 0 48 48" [innerHTML]="peekFront"></svg>
    </span>
  } @else if (image(); as src) { <img [src]="src" alt="" draggable="false" loading="lazy" (error)="failed.set(true)" [class.thumb]="isThumb()"> } @else { <svg viewBox="0 0 48 48" [innerHTML]="svg()"></svg> }`,
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; width: var(--icon-size, 20px); height: var(--icon-size, 20px); flex: none; } svg { width: 100%; height: 100%; display: block; overflow: visible; } img { max-width: 100%; max-height: 100%; display: block; object-fit: contain; } img.thumb { border-radius: 4px; box-shadow: 0 0 0 1px var(--line); }
    .peek { position: relative; display: block; width: 100%; height: 100%; }
    .peek-layer { position: absolute; inset: 0; }
    .peek-layer--front { z-index: 5; filter: drop-shadow(0 -0.5px 1px rgba(0, 0, 0, 0.18)); }
    .peek-card { position: absolute; top: 9%; left: 27%; z-index: 1; display: flex; align-items: flex-start; justify-content: center; width: 46%; height: 50%; transform-origin: 50% 100%; }
    .peek-card svg { width: 100%; height: 100%; }
    .peek-card--thumb { padding: 2.5%; border-radius: 3px; background: #fff; box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.35); }
    .peek-card--thumb img { width: 100%; height: 100%; max-width: none; max-height: none; object-fit: cover; border-radius: 2px; }
    .peek-card:not(.peek-card--thumb) img { width: 82%; height: auto; margin-top: 4%; }
    .peek-card[data-pos="2-0"] { left: 15%; top: 12%; transform: rotate(-9deg); }
    .peek-card[data-pos="2-1"] { left: 39%; top: 9%; transform: rotate(7deg); z-index: 2; }
    .peek-card[data-pos="3-0"] { left: 8%; top: 15%; transform: rotate(-13deg); }
    .peek-card[data-pos="3-1"] { left: 27%; top: 7%; z-index: 3; }
    .peek-card[data-pos="3-2"] { left: 46%; top: 15%; transform: rotate(13deg); z-index: 2; }`],
})
export class FileIconComponent {
  private sanitizer = inject(DomSanitizer);
  private state = inject(StateService);
  entry = input<Entry | null>(null);
  /** 'pc', 'recycle', 'drive:<type>' or a special-folder id such as 'downloads'. */
  special = input<string | undefined>(undefined);
  px = input(20);
  thumbs = input(false);
  failed = signal(false);
  peekBack = trusted(this.sanitizer, 'peek:back', () => FOLDER_PEEK_BACK);
  peekFront = trusted(this.sanitizer, 'peek:front', () => FOLDER_PEEK_FRONT);
  private peekList = signal<Entry[]>([]);
  private peekBroken = signal<ReadonlySet<string>>(new Set());

  constructor() {
    effect(() => { this.entry(); this.failed.set(false); });
    // Big folder icons get a peek of what is inside, loaded lazily and cached per folder version.
    effect(() => {
      const e = this.entry();
      const want = !!e && e.dir && !e.link && this.thumbs() && this.px() >= 40 && !this.special() && this.state.settings().folderPeek;
      this.peekBroken.set(new Set());
      if (!want) { this.peekList.set([]); return; }
      const key = peekKey(e);
      const hit = peeks.get(key);
      if (hit) { this.peekList.set(hit); return; }
      this.peekList.set([]);
      loadPeek(e).then(list => { const now = this.entry(); if (now && peekKey(now) === key) this.peekList.set(list); });
    });
  }

  peekItems = computed<PeekItem[] | null>(() => {
    const broken = this.peekBroken(), px = this.px();
    const items = this.peekList().filter(f => !broken.has(f.path)).map(f => {
      if (hasThumbnail(f)) return { key: f.path, src: thumbUrl(f, Math.min(256, Math.round(px * 1.4))), svg: null, thumb: true };
      if (wantsNativeIcon(f)) return { key: f.path, src: nativeIconUrl(f.path, 64), svg: null, thumb: false };
      const kind = kindOf(f), ext = f.ext.toLowerCase();
      return { key: f.path, src: null, svg: trusted(this.sanitizer, `file:${kind}:${ext}`, () => fileIconSvg(kind, ext)), thumb: false };
    });
    return items.length ? items : null;
  });
  peekFailed(path: string) { this.peekBroken.update(s => new Set(s).add(path)); }

  isThumb = computed(() => { const e = this.entry(); return !!e && this.thumbs() && this.px() >= 40 && hasThumbnail(e); });
  image = computed(() => {
    const e = this.entry();
    if (!e || this.failed() || this.special()) return null;
    if (this.isThumb()) return thumbUrl(e, Math.min(512, this.px() * 2));
    if (wantsNativeIcon(e)) return nativeIconUrl(e.path, this.px() > 24 ? 64 : 16);
    return null;
  });
  svg = computed(() => {
    const sp = this.special(), e = this.entry();
    if (sp === 'pc') return trusted(this.sanitizer, 'pc', () => PC_ICON);
    if (sp === 'recycle') return trusted(this.sanitizer, 'recycle', () => RECYCLE_ICON);
    if (sp?.startsWith('drive:')) return trusted(this.sanitizer, sp, () => driveIconSvg(sp.slice(6)));
    if (!e || e.dir) return trusted(this.sanitizer, 'folder:' + (sp ?? (e?.link ? 'link' : '')), () => folderIconSvg(sp ?? (e?.link ? 'link' : undefined)));
    const kind = kindOf(e), ext = e.ext.toLowerCase();
    return trusted(this.sanitizer, `file:${kind}:${ext}`, () => fileIconSvg(kind, ext));
  });
}
