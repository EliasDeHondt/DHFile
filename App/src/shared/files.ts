import { Entry, SortKey } from './types';

export const PC = 'pc:';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const naturalCompare = (a: string, b: string) => collator.compare(a, b);

export type FileKind = 'folder' | 'image' | 'vector' | 'design' | 'video' | 'audio' | 'archive' | 'code' | 'web' | 'script' | 'config' | 'text' | 'table'
  | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'exe' | 'installer' | 'shortcut' | 'font' | 'disk' | 'database' | 'system' | 'email' | 'calendar'
  | 'contact' | 'ebook' | 'key' | 'model' | 'subtitle' | 'torrent' | 'backup' | 'data' | 'file';

const KINDS: Record<string, FileKind> = {};
const add = (kind: FileKind, exts: string) => { for (const e of exts.split(' ')) KINDS[e] = kind; };
add('image', 'png jpg jpeg jpe jfif gif bmp dib webp tif tiff ico cur heic heif avif jxl raw cr2 cr3 nef nrw arw dng orf rw2 raf srw pef tga dds exr hdr pcx ppm pgm pbm');
add('vector', 'svg svgz eps emf wmf');
add('design', 'psd psb ai xd fig sketch indd idml afdesign afphoto afpub kra xcf cdr clip procreate ora');
add('video', 'mp4 mkv avi mov wmv webm flv f4v m4v mpg mpeg mpe m2v 3gp 3g2 ts mts m2ts vob ogv rm rmvb asf divx');
add('audio', 'mp3 wav flac aac ogg oga m4a m4b wma opus mid midi aif aiff aifc alac ape amr wv mka ac3 dts caf');
add('archive', 'zip zipx rar 7z tar gz tgz bz2 tbz tbz2 xz txz zst lz lzma lz4 cab arj z jar war ear');
add('code', 'js mjs cjs ts cts tsx jsx json jsonc json5 py pyw pyi java class c h cpp cxx cc hpp hxx hh cs csx go rs rb php kt kts swift dart lua r m mm scala sc clj cljs ex exs erl hrl hs elm fs fsx vb pl pm asm s wasm wat d nim zig groovy ipynb gradle sql xml xsd xsl xslt xaml csproj vbproj sln vcxproj props targets vue svelte astro graphql gql proto cmake mk makefile dockerfile tf hcl sol');
add('web', 'html htm xhtml shtml mhtml mht css scss sass less styl');
add('script', 'bat cmd ps1 psm1 psd1 sh bash zsh fish ksh vbs vbe wsf ahk au3 applescript');
add('config', 'ini cfg conf config env toml yml yaml properties reg editorconfig gitignore gitattributes gitmodules npmrc nvmrc prettierrc eslintrc babelrc lock plist inf manifest desktop service');
add('text', 'txt text md markdown mdx log rtf nfo diz readme me rst adoc tex');
add('table', 'csv tsv tab');
add('pdf', 'pdf xps oxps');
add('word', 'doc docx docm dot dotx dotm odt ott pages wpd wps');
add('excel', 'xls xlsx xlsm xlsb xlt xltx xltm ods ots numbers');
add('powerpoint', 'ppt pptx pptm pot potx potm pps ppsx odp otp');
add('exe', 'exe com scr cpl msc gadget');
add('installer', 'msi msp msix msixbundle appx appxbundle appinstaller apk aab xapk deb rpm pkg snap flatpak');
add('shortcut', 'lnk url appref-ms website webloc');
add('font', 'ttf otf ttc woff woff2 fon fnt eot pfb pfm');
add('disk', 'iso img vhd vhdx vmdk vdi qcow2 dmg wim esd swm');
add('database', 'db db3 sqlite sqlite3 mdb accdb sdf mdf ldf ndf dbf frm ibd realm kdb');
add('system', 'dll sys drv ocx mui efi msstyles theme deskthemepack cat');
add('email', 'eml emlx msg mbox oft pst ost');
add('calendar', 'ics ical icalendar vcs');
add('contact', 'vcf vcard contact');
add('ebook', 'epub mobi azw azw3 kfx fb2 djvu cbz cbr cb7');
add('key', 'pem crt cer der key pfx p12 p7b p7c csr pub asc gpg pgp sig ppk jks keystore kdbx');
add('model', 'obj stl fbx blend gltf glb 3mf step stp iges igs dae 3ds max ma mb ply usd usda usdz skp dwg dxf f3d sldprt sldasm ipt iam');
add('subtitle', 'srt vtt ass ssa sub sbv idx');
add('torrent', 'torrent magnet');
add('backup', 'bak old orig tmp temp swp swo part crdownload partial download');
add('data', 'dat bin hex dmp pak sav nbt bson parquet avro pickle pkl npy npz h5 hdf5 mat');

export function kindOf(entry: Pick<Entry, 'dir' | 'ext'>): FileKind {
  if (entry.dir) return 'folder';
  return KINDS[entry.ext.toLowerCase()] ?? 'file';
}

const NATIVE = new Set(['exe', 'lnk', 'ico', 'cur', 'msi', 'url', 'appref-ms', 'website', 'scr', 'cpl', 'msc', 'com']);
export const wantsNativeIcon = (entry: Pick<Entry, 'dir' | 'ext'>) => !entry.dir && NATIVE.has(entry.ext.toLowerCase());

const SHORTCUTS = new Set(['lnk', 'url', 'appref-ms', 'website']);
export const isShortcut = (entry: Pick<Entry, 'dir' | 'ext'>) => !entry.dir && SHORTCUTS.has(entry.ext.toLowerCase());

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
