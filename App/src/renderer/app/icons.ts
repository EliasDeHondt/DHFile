import { FileKind } from '../../shared/files';

const s = (d: string) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;

export const EXTRA_UI_ICONS: Record<string, string> = {
  back: s('M19 12H5M11 6l-6 6 6 6'),
  forward: s('M5 12h14M13 6l6 6-6 6'),
  arrowUp: s('M12 19V5M6 11l6-6 6 6'),
  home: s('M3.5 11L12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5'),
  desktop: `<rect x="3" y="4" width="18" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M9 20.5h6M12 16.5v4')}`,
  downloads: s('M12 4v11M7 10.5l5 5 5-5M5 20h14'),
  documents: s('M7 3.5h7l4.5 4.5v12.5H7zM14 3.5V8h4.5M9.5 12.5h6M9.5 16h6'),
  pictures: `<rect x="3.5" y="4.5" width="17" height="15" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9.5" r="1.6" fill="currentColor"/>${s('M3.5 17l5-4.5 4 3.5 3-2.5 5 4')}`,
  music: `${s('M9 18V6l11-2v12')}<circle cx="6.5" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.5" cy="16" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  videos: `<rect x="3" y="6" width="13" height="12" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M16 10.5l5-3v9l-5-3')}`,
  onedrive: s('M7 18.5h11a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 8 10a4.3 4.3 0 0 0-1 8.5z'),
  pc: `<rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M8 20h8M12 16v4')}`,
  drive: `<rect x="3" y="8" width="18" height="9" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="12.5" r="1" fill="currentColor"/>${s('M6.5 12.5h5')}`,
  usb: s('M9 3.5h6v6H9zM7.5 9.5h9V18a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3zM11 6v1M13 6v1'),
  network: s('M4 16.5h16M12 16.5V20M8 20h8M6 4h12v8.5H6z'),
  disc: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  recycle: s('M5 7h14M10 4h4M7 7l1 13h8l1-13M10.5 10.5v6M13.5 10.5v6'),
  cut: `<circle cx="6.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M8.3 15.7L18 4M15.7 15.7L6 4')}`,
  newFolder: s('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10.5v5M9.5 13h5'),
  newFile: s('M7 3.5h7l4.5 4.5v12.5H7zM14 3.5V8h4.5M12.75 11v6M9.75 14h6'),
  sort: s('M7 4v16M3.5 16.5L7 20l3.5-3.5M14 6h7M14 11h5M14 16h3'),
  list: s('M8.5 6.5h12M8.5 12h12M8.5 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01'),
  grid: `<rect x="4" y="4" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  panel: `<rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M14.5 4v16')}`,
  pin: s('M9 4h6l-1 5 3.5 3.5h-11L10 9zM12 12.5V20'),
  unpin: s('M3.5 3.5l17 17M9 4h6l-1 5 3.5 3.5h-4M7 12.5h3.5M12 12.5V20'),
  terminal: `<rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M7 9.5l3 2.5-3 2.5M12.5 15h4')}`,
  code: s('M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14'),
  openWith: s('M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM9 15l6-6M10 9h5v5'),
  info: `<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M12 11v5.5')}<circle cx="12" cy="7.8" r="1" fill="currentColor"/>`,
  more: `<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>`,
  chevronRight: s('M9.5 6l6 6-6 6'),
  selectAll: `<rect x="4" y="4" width="16" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.4"/>${s('M8.5 12.5l2.5 2.5 4.5-5')}`,
  link: s('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
  hidden: s('M3 3l18 18M10.6 6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-2.7 3.4M6.4 6.9A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2'),
  explorer: s('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18'),
};

/* ---------- File icons, drawn on a 48 x 48 grid ---------- */

const FOLDER_BACK = '#2f6fc9';
const FOLDER_FRONT = '#4f94f0';
const folderShape = (glyph = '') =>
  `<path d="M4 11a4 4 0 0 1 4-4h10.6a4 4 0 0 1 2.8 1.2L24.2 11H40a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="${FOLDER_BACK}"/>` +
  `<path d="M4 18.5a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4V37a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="${FOLDER_FRONT}"/>` +
  `<path d="M8 15.5h32" stroke="#8dbaf7" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>` +
  (glyph ? `<g transform="translate(16.5 20.5) scale(.625)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>` : '');

/** Glyphs on the 24-grid, reused inside special folders. */
const GLYPHS: Record<string, string> = {
  home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/>',
  desktop: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M9 20.5h6M12 16.5v4"/>',
  downloads: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  documents: '<path d="M7 3.5h7l4.5 4.5v12.5H7zM9.5 12.5h6M9.5 16h6"/>',
  pictures: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><path d="M3.5 17l5-4.5 4 3.5 3-2.5 5 4"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  videos: '<rect x="3" y="6" width="13" height="12" rx="2.2"/><path d="M16 10.5l5-3v9l-5-3"/>',
  onedrive: '<path d="M7 18.5h11a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 8 10a4.3 4.3 0 0 0-1 8.5z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};

export const KIND_COLORS: Record<FileKind, string> = {
  folder: FOLDER_FRONT, image: '#1baf7a', video: '#e74c3c', audio: '#8b5cf6', archive: '#d99a00', code: '#4f94f0', text: '#6b7280',
  pdf: '#e2412f', word: '#2b6fd6', excel: '#1d8f4e', powerpoint: '#d9622b', exe: '#0f54ae', shortcut: '#4f94f0', font: '#374151',
  disk: '#6b7280', data: '#6b7280', file: '#829ec2',
};

const page = '<path d="M11 3.5h17.5L39 14v28.5a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-37a2 2 0 0 1 2-2z" fill="#f4f6f9" stroke="#c3ccd7" stroke-width="1"/><path d="M28.5 3.5V12a2 2 0 0 0 2 2H39" fill="#dde3eb" stroke="#c3ccd7" stroke-width="1" stroke-linejoin="round"/>';
const lines = '<path d="M15 21h18M15 26h18M15 31h12" stroke="#c3ccd7" stroke-width="2" stroke-linecap="round"/>';
const esc = (t: string) => t.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));

export function fileIconSvg(kind: FileKind, ext: string): string {
  const label = ext.slice(0, 4).toUpperCase();
  if (!label) return page + lines;
  const color = KIND_COLORS[kind];
  const size = label.length > 3 ? 7.2 : 8.4;
  return page + `<path d="M15 19h18M15 23.5h12" stroke="#c3ccd7" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="5" y="28" width="${label.length > 3 ? 30 : 26}" height="12.5" rx="3" fill="${color}"/>` +
    `<text x="${label.length > 3 ? 20 : 18}" y="37.2" text-anchor="middle" font-size="${size}" font-weight="700" fill="#fff" font-family="Segoe UI Variable Display, Segoe UI, Roboto, sans-serif">${esc(label)}</text>`;
}

export function folderIconSvg(special?: string): string { return folderShape(special ? GLYPHS[special] ?? '' : ''); }

export function driveIconSvg(type: string): string {
  const body = '<rect x="4" y="15" width="40" height="19" rx="4.5" fill="#3a4150"/><rect x="4" y="15" width="40" height="7" rx="3.5" fill="#4a5262"/>';
  const led = `<circle cx="37.5" cy="28" r="2" fill="${type === 'network' ? '#eda100' : '#1baf7a'}"/>`;
  const slot = '<path d="M10 28h14" stroke="#7b8494" stroke-width="2" stroke-linecap="round"/>';
  const badge = type === 'removable' ? '<path d="M20 8h8v7h-8z" fill="#829ec2"/>' : type === 'network' ? '<path d="M24 34v6M16 41h16" stroke="#829ec2" stroke-width="2.4" stroke-linecap="round"/>' : type === 'cd' ? '<circle cx="24" cy="10" r="5" fill="none" stroke="#829ec2" stroke-width="2"/>' : '';
  return badge + body + slot + led;
}

export const PC_ICON = '<rect x="5" y="8" width="38" height="25" rx="3.5" fill="#3a4150"/><rect x="8" y="11" width="32" height="19" rx="1.5" fill="#4f94f0"/><path d="M8 11h32v6c-10 3-22 3-32 0z" fill="#86b6ff" opacity=".45"/><path d="M19 33h10l1.5 6h-13z" fill="#5b6475"/><rect x="14" y="39" width="20" height="3" rx="1.5" fill="#3a4150"/>';
export const RECYCLE_ICON = '<path d="M12 14h24l-2.2 26a3 3 0 0 1-3 2.7H17.2a3 3 0 0 1-3-2.7z" fill="#cfd8e3" stroke="#8a95a5" stroke-width="1.2"/><rect x="9" y="9" width="30" height="5" rx="2" fill="#8a95a5"/><path d="M20 9V6.5h8V9" fill="none" stroke="#8a95a5" stroke-width="1.6"/><path d="M19 20v17M24 20v17M29 20v17" stroke="#8a95a5" stroke-width="1.6" stroke-linecap="round"/>';

const BASE_UI_ICONS: Record<string, string> = {
  plus: s('M12 5v14M5 12h14'),
  chevron: s('M6 9.5l6 6 6-6'),
  close: s('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  gear: `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M12 2.8l1.6 2.3 2.7-.7.6 2.7 2.6 1-.9 2.6 1.9 2.1-2 1.9.7 2.7-2.7.5-1 2.6-2.6-.9L12 21.2l-1.9-2-2.6.8-.8-2.7-2.7-.8.8-2.6-2-1.9 2-2-.9-2.6 2.7-.9.6-2.6 2.7.7z')}`,
  bolt: s('M13 2.5L5 13.5h6l-1 8 8-11h-6l1-8z'),
  help: `<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4')}<circle cx="12" cy="16.8" r="1" fill="currentColor"/>`,
  search: `<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M15 15l5.5 5.5')}`,
  up: s('M6 14.5l6-6 6 6'),
  down: s('M6 9.5l6 6 6-6'),
  splitRight: `<rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M12 4v16')}`,
  splitDown: `<rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M3 12h18')}`,
  copy: `<rect x="8" y="8" width="12" height="12" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2')}`,
  paste: `<rect x="5" y="4.5" width="14" height="16.5" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M9 4.5h6v3H9z')}`,
  folder: s('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  trash: s('M4.5 7h15M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7'),
  check: s('M5 12.5l4.5 4.5L19 7.5'),
  reset: s('M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9'),
  window: `<rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M3 8.5h18')}`,
  rocket: s('M12 15l-3-3c1.5-4.5 4.5-7.5 10-8-.5 5.5-3.5 8.5-8 10zM9 12l-3.5-.5L8 8.5h3.5M12 15l.5 3.5 3-2.5v-3.5M6 18.5c.5-1.5 1.5-2.5 3-2.5'),
  brush: s('M17.5 3.5l3 3-9 9-3-3zM8.5 12.5c-2.5 0-4 1.5-4 4 0 1.5-1 2.5-2 3 3.5 1 7.5 0 8.5-3'),
  pointer: s('M5 3.5l13 7-6 1.5-2.5 6z'),
  layers: s('M12 3l9 5-9 5-9-5zM3 13l9 5 9-5'),
  swatch: `<circle cx="7.5" cy="10" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="16.5" cy="10" r="1.3" fill="currentColor"/>${s('M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-1 1.3-2-.6-1.2.2-2.5 1.5-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z')}`,
  edit: s('M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4'),
  external: s('M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'),
  refresh: s('M20 11a8 8 0 0 0-14.5-4.5M4 4.5V9h4.5M4 13a8 8 0 0 0 14.5 4.5M20 19.5V15h-4.5'),
  eye: `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>${s('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z')}`,
  eyeOff: s('M3 3l18 18M10.6 6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-2.7 3.4M6.4 6.9A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2'),
  star: s('M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z'),
  sun: s('M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4'),
  moon: s('M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z'),
  globe: s('M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19zM2.5 12h19M12 2.5c2.5 2.6 3.8 5.8 3.8 9.5s-1.3 6.9-3.8 9.5c-2.5-2.6-3.8-5.8-3.8-9.5S9.5 5.1 12 2.5z'),
  lock: s('M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5zM8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2'),
  key: s('M14.5 4a5.5 5.5 0 1 1-4.9 8L4 17.6V20h2.4v-1.6H8V16.8h1.6l2.2-2.2A5.5 5.5 0 0 1 14.5 4zM16 7.5h.01'),
  backspace: s('M9 5.5h10a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9L3.5 12zM11.5 9.5l5 5M16.5 9.5l-5 5'),
};

export const UI_ICONS: Record<string, string> = { ...BASE_UI_ICONS, ...EXTRA_UI_ICONS };
