import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { hasThumbnail, kindOf, wantsNativeIcon } from '../../shared/files';
import { Entry } from '../../shared/types';
import { nativeIconUrl, thumbUrl } from './bridge';
import { driveIconSvg, fileIconSvg, folderIconSvg, PC_ICON, RECYCLE_ICON, UI_ICONS } from './icons';

const cache = new Map<string, SafeHtml>();
function trusted(sanitizer: DomSanitizer, key: string, make: () => string) {
  let v = cache.get(key);
  if (!v) { v = sanitizer.bypassSecurityTrustHtml(make()); cache.set(key, v); }
  return v;
}

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
  template: `@if (image(); as src) { <img [src]="src" alt="" draggable="false" loading="lazy" (error)="failed.set(true)" [class.thumb]="isThumb()"> } @else { <svg viewBox="0 0 48 48" [innerHTML]="svg()"></svg> }`,
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; width: var(--icon-size, 20px); height: var(--icon-size, 20px); flex: none; } svg { width: 100%; height: 100%; display: block; overflow: visible; } img { max-width: 100%; max-height: 100%; display: block; object-fit: contain; } img.thumb { border-radius: 4px; box-shadow: 0 0 0 1px var(--line); }`],
})
export class FileIconComponent {
  private sanitizer = inject(DomSanitizer);
  entry = input<Entry | null>(null);
  /** 'pc', 'recycle', 'drive:<type>' or a special-folder id such as 'downloads'. */
  special = input<string | undefined>(undefined);
  px = input(20);
  thumbs = input(false);
  failed = signal(false);

  constructor() { effect(() => { this.entry(); this.failed.set(false); }); }

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
