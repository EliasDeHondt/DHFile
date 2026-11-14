import { Entry, SortKey } from './types';

export const PC = 'pc:';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const naturalCompare = (a: string, b: string) => collator.compare(a, b);

/** File categories drive both the icon and the "Type" column. */
export type FileKind = 'folder' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'text' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'exe' | 'shortcut' | 'font' | 'disk' | 'data' | 'file';

const KINDS: Record<string, FileKind> = {};
const add = (kind: FileKind, exts: string) => { for (const e of exts.split(' ')) KINDS[e] = kind; };
add('image', 'png jpg jpeg gif bmp webp tif tiff ico svg heic heif avif raw cr2 nef psd jfif');
add('video', 'mp4 mkv avi mov wmv webm flv m4v mpg mpeg 3gp ts');
add('audio', 'mp3 wav flac aac ogg m4a wma opus mid midi');
add('archive', 'zip rar 7z tar gz tgz bz2 xz zst cab lz');
add('code', 'js mjs cjs ts tsx jsx json jsonc html htm css scss less py java c h cpp hpp cs go rs rb php sh ps1 psm1 bat cmd kt swift sql xml yml yaml toml vue svelte dart lua r m ipynb gradle');
add('text', 'txt md log ini cfg conf csv tsv rtf nfo env gitignore editorconfig');
add('pdf', 'pdf');
add('word', 'doc docx odt dotx');
add('excel', 'xls xlsx xlsm ods xltx');
add('powerpoint', 'ppt pptx odp potx');
add('exe', 'exe msi com scr appx msix appinstaller');
add('shortcut', 'lnk url appref-ms');
add('font', 'ttf otf woff woff2 fon');
add('disk', 'iso img vhd vhdx vmdk');
add('data', 'db sqlite dll sys dat bin bak tmp');

export function kindOf(entry: Pick<Entry, 'dir' | 'ext'>): FileKind {
  if (entry.dir) return 'folder';
  return KINDS[entry.ext.toLowerCase()] ?? 'file';
}

/** Extensions whose real Windows icon (the app's own icon) beats a generic one. */
const NATIVE = new Set(['exe', 'lnk', 'ico', 'msi', 'url', 'appref-ms', 'scr', 'cpl', 'msc']);
export const wantsNativeIcon = (entry: Pick<Entry, 'dir' | 'ext'>) => !entry.dir && NATIVE.has(entry.ext.toLowerCase());

const THUMBS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff', 'heic', 'heif', 'avif', 'jfif', 'mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm', 'm4v', 'pdf', 'psd']);
export const hasThumbnail = (entry: Pick<Entry, 'dir' | 'ext'>) => !entry.dir && THUMBS.has(entry.ext.toLowerCase());

const TEXT = new Set(['txt', 'md', 'log', 'ini', 'cfg', 'conf', 'csv', 'tsv', 'nfo', 'env', 'gitignore', 'editorconfig', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'jsonc', 'html', 'htm', 'css', 'scss', 'less', 'py', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'sh', 'ps1', 'psm1', 'bat', 'cmd', 'kt', 'swift', 'sql', 'xml', 'yml', 'yaml', 'toml', 'vue', 'svelte', 'dart', 'lua', 'r', 'gradle', 'svg', 'reg', 'properties', 'lock']);
export const isTextFile = (ext: string) => TEXT.has(ext.toLowerCase());

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : '';
}

export function stem(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export function displayName(entry: Pick<Entry, 'name' | 'dir'>, showExtensions: boolean): string {
  return showExtensions || entry.dir ? entry.name : stem(entry.name);
}

export function sortEntries(entries: Entry[], key: SortKey, dir: number, foldersFirst: boolean, typeLabel: (e: Entry) => string = e => e.ext): Entry[] {
  const sign = dir < 0 ? -1 : 1;
  const by = (a: Entry, b: Entry): number => {
    switch (key) {
      case 'mtime': return a.mtime - b.mtime;
      case 'size': return a.size - b.size;
      case 'type': return naturalCompare(typeLabel(a), typeLabel(b));
      default: return 0;
    }
  };
  return [...entries].sort((a, b) => {
    if (foldersFirst && a.dir !== b.dir) return a.dir ? -1 : 1;
    return sign * (by(a, b) || naturalCompare(a.name, b.name));
  });
}

/** "New folder", "New folder (2)", ... the way Explorer counts. */
export function uniqueName(wanted: string, taken: Iterable<string>, opts: { copy?: boolean; dir?: boolean } = {}): string {
  const copy = !!opts.copy;
  const lower = new Set(Array.from(taken, n => n.toLowerCase()));
  if (!lower.has(wanted.toLowerCase())) return wanted;
  const isFile = !opts.dir && !!extOf(wanted);
  const base = isFile ? stem(wanted) : wanted;
  const suffix = isFile ? '.' + wanted.slice(wanted.lastIndexOf('.') + 1) : '';
  const root = copy ? base.replace(/ - Copy( \(\d+\))?$/, '') + ' - Copy' : base.replace(/ \(\d+\)$/, '');
  if (copy && !lower.has((root + suffix).toLowerCase())) return root + suffix;
  for (let n = 2; ; n++) {
    const candidate = `${root} (${n})${suffix}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
/** Returns null when Windows accepts the name, otherwise a short reason key. */
export function invalidName(name: string): 'empty' | 'chars' | 'reserved' | 'dots' | null {
  if (!name.trim()) return 'empty';
  if (/[<>:"/\\|?*\x00-\x1f]/.test(name)) return 'chars';
  if (RESERVED.test(name)) return 'reserved';
  if (name === '.' || name === '..' || /[. ]$/.test(name)) return 'dots';
  return null;
}

export const normalizePath = (p: string) => {
  let out = p.replace(/\//g, '\\');
  if (/^[a-z]:$/i.test(out)) out += '\\';
  if (out.length > 3 && out.endsWith('\\')) out = out.replace(/\\+$/, '');
  return /^[a-z]:/.test(out) ? out[0].toUpperCase() + out.slice(1) : out;
};

export function parentOf(p: string): string | null {
  const n = normalizePath(p);
  if (/^[A-Z]:\\$/i.test(n)) return PC;
  if (/^\\\\[^\\]+\\[^\\]+$/.test(n)) return null;
  const i = n.lastIndexOf('\\');
  if (i < 0) return null;
  const up = n.slice(0, i);
  return /^[A-Z]:$/i.test(up) ? up + '\\' : up;
}

export function baseName(p: string): string {
  const n = normalizePath(p);
  if (/^[A-Z]:\\$/i.test(n)) return n.slice(0, 2);
  return n.slice(n.lastIndexOf('\\') + 1) || n;
}

export function joinPath(dir: string, name: string): string {
  const d = normalizePath(dir);
  return d.endsWith('\\') ? d + name : d + '\\' + name;
}

export function samePath(a: string, b: string) { return normalizePath(a).toLowerCase() === normalizePath(b).toLowerCase(); }

/** True when `child` is `parent` itself or somewhere below it. */
export function isInside(child: string, parent: string): boolean {
  const c = normalizePath(child).toLowerCase(), p = normalizePath(parent).toLowerCase();
  return c === p || c.startsWith(p.endsWith('\\') ? p : p + '\\');
}

export interface Crumb { label: string; path: string; }
export function crumbs(p: string): Crumb[] {
  if (p === PC) return [];
  const n = normalizePath(p);
  const out: Crumb[] = [];
  let rest: string[];
  if (n.startsWith('\\\\')) {
    const parts = n.slice(2).split('\\').filter(Boolean);
    const root = '\\\\' + parts.slice(0, 2).join('\\');
    out.push({ label: root, path: root });
    rest = parts.slice(2);
    let cur = root;
    for (const part of rest) { cur += '\\' + part; out.push({ label: part, path: cur }); }
    return out;
  }
  const [drive, ...parts] = n.split('\\').filter(Boolean);
  let cur = drive + '\\';
  out.push({ label: drive, path: cur });
  for (const part of parts) { cur = joinPath(cur, part); out.push({ label: part, path: cur }); }
  return out;
}

/** Explorer-style search: plain text matches anywhere, * and ? work as wildcards. */
export function matcher(query: string): (name: string) => boolean {
  const q = query.trim().toLowerCase();
  if (!q) return () => true;
  if (!/[*?]/.test(q)) return name => name.toLowerCase().includes(q);
  const re = new RegExp('^' + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
  return name => re.test(name);
}

export function formatSize(bytes: number, units: string[] = ['B', 'KB', 'MB', 'GB', 'TB']): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  let v = bytes, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2).replace(/\.?0+$/, '')} ${units[i]}`;
}
