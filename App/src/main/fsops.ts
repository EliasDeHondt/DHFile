/**
    * @author Group DH Team
    * @see https://group-dh.com
    * @since 16/11/2026
**/

import { execFile } from 'node:child_process';
import { constants, Dirent, FSWatcher, watch } from 'node:fs';
import { chmod, cp, lstat, mkdir, readdir, readFile, rename, rm, stat, writeFile, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { extOf, hasThumbnail, isInside, joinPath, matcher, naturalCompare, normalizePath, samePath, uniqueName } from '../shared/files';
import { Entry, Listing, OpResult, Preview, Properties, TransferRequest, TransferResult } from '../shared/types';

const SYSTEM_NAMES = new Set(['$recycle.bin', 'system volume information', 'pagefile.sys', 'hiberfil.sys', 'swapfile.sys', 'dumpstack.log.tmp', 'dumpstack.log', 'desktop.ini', 'thumbs.db', 'config.msi', '$winreagent', '$windows.~ws', '$windows.~bt', '$sysreset', 'recovery', 'documents and settings', 'ntuser.dat']);

function hiddenNames(dir: string): Promise<Set<string>> {
  if (process.platform !== 'win32') return Promise.resolve(new Set());
  return new Promise(resolve => {
    execFile('cmd.exe', ['/d', '/u', '/c', 'dir', '/a:h', '/b', dir], { encoding: 'buffer', windowsHide: true, timeout: 4000, maxBuffer: 16 << 20 }, (_err, stdout) => {
      const text = Buffer.isBuffer(stdout) ? stdout.toString('utf16le') : '';
      resolve(new Set(text.split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean)));
    });
  });
}

async function toEntry(dir: string, d: Dirent | string, hidden: Set<string>): Promise<Entry | null> {
  const name = typeof d === 'string' ? d : d.name;
  const path = joinPath(dir, name);
  try {
    const l = await lstat(path);
    let s = l, link = l.isSymbolicLink();
    if (link) { try { s = await stat(path); } catch { } }
    const isDir = s.isDirectory();
    const lower = name.toLowerCase();
    return {
      name, path, dir: isDir, link,
      size: isDir ? 0 : s.size,
      mtime: s.mtimeMs, ctime: s.birthtimeMs || s.ctimeMs,
      ext: isDir ? '' : extOf(name),
      hidden: name.startsWith('.') || hidden.has(lower) || SYSTEM_NAMES.has(lower),
      readonly: !isDir && (s.mode & constants.S_IWUSR) === 0,
    };
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export async function peek(path: string, max = 3): Promise<Entry[]> {
  const dir = normalizePath(path);
  try {
    const files = (await readdir(dir, { withFileTypes: true }))
      .filter(d => (d.isFile() || d.isSymbolicLink()) && !d.name.startsWith('.') && !d.name.startsWith('~$') && !SYSTEM_NAMES.has(d.name.toLowerCase()))
      .sort((a, b) => naturalCompare(a.name, b.name));
    const pictures = files.filter(d => hasThumbnail({ dir: false, ext: extOf(d.name) }));
    const pick = [...pictures, ...files.filter(d => !pictures.includes(d))].slice(0, max);
    const none = new Set<string>();
    return (await Promise.all(pick.map(d => toEntry(dir, d, none)))).filter((e): e is Entry => !!e && !e.dir);
  } catch {
    return [];
  }
}

export async function list(path: string): Promise<Listing> {
  const dir = normalizePath(path);
  try {
    const [dirents, hidden] = await Promise.all([readdir(dir, { withFileTypes: true }), hiddenNames(dir)]);
    const entries = (await mapLimit(dirents, 64, d => toEntry(dir, d, hidden))).filter((e): e is Entry => !!e);
    return { path: dir, entries };
  } catch (err: any) {
    return { path: dir, entries: [], error: String(err?.message ?? err), code: err?.code };
  }
}

export async function isDirectory(path: string) { try { return (await stat(path)).isDirectory(); } catch { return false; } }
export async function exists(path: string) { try { await lstat(path); return true; } catch { return false; } }

async function namesIn(dir: string) { try { return await readdir(dir); } catch { return []; } }

export async function mkdirUnique(dir: string, wanted: string): Promise<OpResult> {
  try {
    const name = uniqueName(wanted, await namesIn(dir), { dir: true });
    const path = joinPath(dir, name);
    await mkdir(path);
    return { ok: true, path };
  } catch (err: any) { return { ok: false, error: String(err?.message ?? err) }; }
}

export async function newFile(dir: string, wanted: string): Promise<OpResult> {
  try {
    const name = uniqueName(wanted, await namesIn(dir));
    const path = joinPath(dir, name);
    await writeFile(path, '', { flag: 'wx' });
    return { ok: true, path };
  } catch (err: any) { return { ok: false, error: String(err?.message ?? err) }; }
}

export async function renameEntry(path: string, name: string): Promise<OpResult> {
  const target = joinPath(dirname(path), name);
  try {
    if (!samePath(path, target) && await exists(target)) return { ok: false, error: 'exists' };
    await rename(path, target);
    return { ok: true, path: target };
  } catch (err: any) { return { ok: false, error: String(err?.message ?? err) }; }
}

export async function remove(paths: string[]): Promise<OpResult> {
  const errors: string[] = [];
  for (const p of paths) { try { await rm(p, { recursive: true, force: true, maxRetries: 2 }); } catch (err: any) { errors.push(String(err?.message ?? err)); } }
  return errors.length ? { ok: false, error: errors[0] } : { ok: true };
}

async function moveOne(src: string, dest: string) {
  try { await rename(src, dest); }
  catch (err: any) {
    if (err?.code !== 'EXDEV' && err?.code !== 'EPERM') throw err;
    await cp(src, dest, { recursive: true, force: true, errorOnExist: false, preserveTimestamps: true });
    await rm(src, { recursive: true, force: true, maxRetries: 2 });
  }
}

export async function transfer(req: TransferRequest): Promise<TransferResult> {
  const dest = normalizePath(req.dest);
  const sources = req.sources.map(normalizePath);
  const taken = await namesIn(dest);
  const takenLower = new Set(taken.map(n => n.toLowerCase()));
  const result: TransferResult = { ok: true, created: [], failed: [] };

  const plans: { src: string; name: string; dir: boolean; same: boolean }[] = [];
  for (const src of sources) {
    const name = src.slice(src.lastIndexOf('\\') + 1);
    if (isInside(dest, src)) { result.failed.push({ path: src, error: 'inside' }); continue; }
    const same = samePath(dirname(src), dest);
    if (same && req.mode === 'move') continue;
    plans.push({ src, name, dir: await isDirectory(src), same });
  }

  const conflicts = plans.filter(p => !p.same && takenLower.has(p.name.toLowerCase())).map(p => p.name);
  if (conflicts.length && req.conflict === 'ask') return { ok: false, conflicts, created: [], failed: result.failed };

  for (const p of plans) {
    let name = p.name;
    const clash = takenLower.has(name.toLowerCase());
    if (p.same || (clash && req.conflict === 'keep')) name = uniqueName(name, taken, { copy: p.same, dir: p.dir });
    else if (clash && req.conflict === 'skip') continue;
    const target = joinPath(dest, name);
    try {
      if (clash && req.conflict === 'replace' && !samePath(target, p.src)) await rm(target, { recursive: true, force: true });
      if (req.mode === 'copy') await cp(p.src, target, { recursive: true, force: true, errorOnExist: false, preserveTimestamps: true });
      else await moveOne(p.src, target);
      taken.push(name); takenLower.add(name.toLowerCase());
      result.created.push(target);
    } catch (err: any) {
      result.failed.push({ path: p.src, error: String(err?.message ?? err) });
    }
  }
  result.ok = result.failed.length === 0;
  return result;
}

export async function properties(path: string, onUpdate: (p: Properties) => void, isCancelled: () => boolean): Promise<Properties> {
  const s = await stat(path);
  const name = path.slice(normalizePath(path).lastIndexOf('\\') + 1) || path;
  const hidden = (await hiddenNames(dirname(path))).has(name.toLowerCase());
  const props: Properties = { path, name, dir: s.isDirectory(), size: s.isDirectory() ? 0 : s.size, files: 0, folders: 0, created: s.birthtimeMs || s.ctimeMs, modified: s.mtimeMs, accessed: s.atimeMs, readonly: (s.mode & constants.S_IWUSR) === 0, hidden, done: !s.isDirectory() };
  if (!props.dir) return props;
  let last = Date.now();
  const walk = async (dir: string) => {
    if (isCancelled()) return;
    let items: Dirent[];
    try { items = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const d of items) {
      if (isCancelled()) return;
      const p = join(dir, d.name);
      if (d.isDirectory()) { props.folders++; await walk(p); }
      else if (d.isFile()) { props.files++; try { props.size += (await lstat(p)).size; } catch {} }
      if (Date.now() - last > 250) { last = Date.now(); onUpdate({ ...props }); }
    }
  };
  await walk(path);
  props.done = true;
  return props;
}

export async function setReadonly(path: string, readonly: boolean): Promise<OpResult> {
  try { const s = await stat(path); await chmod(path, readonly ? s.mode & ~0o222 : s.mode | 0o200); return { ok: true }; }
  catch (err: any) { return { ok: false, error: String(err?.message ?? err) }; }
}

export async function preview(path: string): Promise<Preview> {
  const LIMIT = 64 * 1024;
  try {
    const fh = await open(path, 'r');
    try {
      const buf = Buffer.alloc(LIMIT);
      const { bytesRead } = await fh.read(buf, 0, LIMIT, 0);
      const slice = buf.subarray(0, bytesRead);
      if (slice.includes(0) && !(slice[0] === 0xff && slice[1] === 0xfe)) return { kind: 'none' };
      const text = slice[0] === 0xff && slice[1] === 0xfe ? slice.subarray(2).toString('utf16le') : slice.toString('utf8').replace(/^﻿/, '');
      return { kind: 'text', text, truncated: bytesRead === LIMIT };
    } finally { await fh.close(); }
  } catch { return { kind: 'none' }; }
}

export async function readSmall(path: string): Promise<string | null> { try { return await readFile(path, 'utf8'); } catch { return null; } }

export async function search(root: string, query: string, emit: (batch: Entry[]) => void, isCancelled: () => boolean, max = 5000) {
  const match = matcher(query);
  let found = 0, batch: Entry[] = [], lastEmit = Date.now();
  const flush = () => { if (batch.length) { emit(batch); batch = []; lastEmit = Date.now(); } };
  const queue: string[] = [normalizePath(root)];
  while (queue.length && !isCancelled() && found < max) {
    const dir = queue.shift()!;
    let items: Dirent[];
    try { items = await readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const d of items) {
      if (isCancelled() || found >= max) break;
      const lower = d.name.toLowerCase();
      if (lower === '$recycle.bin' || lower === 'system volume information') continue;
      if (d.isDirectory() && !d.isSymbolicLink()) queue.push(joinPath(dir, d.name));
      if (match(d.name)) {
        const e = await toEntry(dir, d, new Set());
        if (e) { e.parent = dir; batch.push(e); found++; }
      }
    }
    if (batch.length >= 200 || Date.now() - lastEmit > 300) flush();
  }
  flush();
}

export class Watchers {
  private map = new Map<string, { w: FSWatcher; t: NodeJS.Timeout | null }>();
  set(key: string, path: string | null, onChange: () => void) {
    this.clear(key);
    if (!path || path === 'pc:') return;
    try {
      const entry = { w: watch(path, { persistent: false }), t: null as NodeJS.Timeout | null };
      entry.w.on('change', () => { if (entry.t) clearTimeout(entry.t); entry.t = setTimeout(onChange, 200); });
      entry.w.on('error', () => this.clear(key));
      this.map.set(key, entry);
    } catch {}
  }
  clear(key: string) { const e = this.map.get(key); if (e) { if (e.t) clearTimeout(e.t); try { e.w.close(); } catch {} this.map.delete(key); } }
  clearPrefix(prefix: string) { for (const k of [...this.map.keys()]) if (k.startsWith(prefix)) this.clear(k); }
}