const test = require('node:test');
const assert = require('node:assert');
const { uniqueName, invalidName, normalizePath, parentOf, baseName, joinPath, isInside, crumbs, matcher, formatSize, sortEntries, kindOf, extOf, displayName, PC } = require('../dist/main/shared/files.js');
const { sanitize } = require('../dist/main/main/settings.js');

test('new names count up the way Explorer does', () => {
  assert.strictEqual(uniqueName('New folder', ['a', 'b'], { dir: true }), 'New folder');
  assert.strictEqual(uniqueName('New folder', ['New folder'], { dir: true }), 'New folder (2)');
  assert.strictEqual(uniqueName('New folder', ['new folder', 'New folder (2)'], { dir: true }), 'New folder (3)');
  assert.strictEqual(uniqueName('New Text Document.txt', ['New Text Document.txt'], {}), 'New Text Document (2).txt');
  assert.strictEqual(uniqueName('my.folder', ['my.folder'], { dir: true }), 'my.folder (2)');
});

test('copies in the same folder get " - Copy"', () => {
  assert.strictEqual(uniqueName('a.txt', ['a.txt'], { copy: true }), 'a - Copy.txt');
  assert.strictEqual(uniqueName('a.txt', ['a.txt', 'a - Copy.txt'], { copy: true }), 'a - Copy (2).txt');
  assert.strictEqual(uniqueName('a - Copy.txt', ['a.txt', 'a - Copy.txt'], { copy: true }), 'a - Copy (2).txt');
  assert.strictEqual(uniqueName('Photos', ['Photos'], { copy: true, dir: true }), 'Photos - Copy');
});

test('names Windows refuses are caught', () => {
  assert.strictEqual(invalidName('report.pdf'), null);
  assert.strictEqual(invalidName('  '), 'empty');
  assert.strictEqual(invalidName('a:b'), 'chars');
  assert.strictEqual(invalidName('what?'), 'chars');
  assert.strictEqual(invalidName('CON'), 'reserved');
  assert.strictEqual(invalidName('nul.txt'), 'reserved');
  assert.strictEqual(invalidName('trailing.'), 'dots');
  assert.strictEqual(invalidName('trailing '), 'dots');
});

test('paths normalise, split and join', () => {
  assert.strictEqual(normalizePath('c:/Users/elias/'), 'C:\\Users\\elias');
  assert.strictEqual(normalizePath('d:'), 'D:\\');
  assert.strictEqual(parentOf('C:\\Users\\elias'), 'C:\\Users');
  assert.strictEqual(parentOf('C:\\Users'), 'C:\\');
  assert.strictEqual(parentOf('C:\\'), PC);
  assert.strictEqual(baseName('C:\\Users\\elias'), 'elias');
  assert.strictEqual(baseName('C:\\'), 'C:');
  assert.strictEqual(joinPath('C:\\', 'Windows'), 'C:\\Windows');
  assert.strictEqual(joinPath('C:\\Users', 'x.txt'), 'C:\\Users\\x.txt');
});

test('isInside guards against copying a folder into itself', () => {
  assert.ok(isInside('C:\\a\\b', 'C:\\a'));
  assert.ok(isInside('c:\\A', 'C:\\a'));
  assert.ok(!isInside('C:\\ab', 'C:\\a'));
  assert.ok(isInside('C:\\a', 'C:\\'));
});

test('breadcrumbs for drives and network shares', () => {
  assert.deepStrictEqual(crumbs('C:\\Users\\elias').map(c => c.path), ['C:\\', 'C:\\Users', 'C:\\Users\\elias']);
  assert.deepStrictEqual(crumbs('C:\\').map(c => c.label), ['C:']);
  assert.deepStrictEqual(crumbs('\\\\nas\\share\\docs').map(c => c.path), ['\\\\nas\\share', '\\\\nas\\share\\docs']);
  assert.deepStrictEqual(crumbs(PC), []);
});

test('search matches text anywhere, or wildcards', () => {
  assert.ok(matcher('port')('Report.PDF'));
  assert.ok(!matcher('xyz')('Report.pdf'));
  assert.ok(matcher('*.pdf')('Report.PDF'));
  assert.ok(!matcher('*.pdf')('Report.pdf.txt'));
  assert.ok(matcher('IMG_??.jpg')('img_12.jpg'));
  assert.ok(matcher('')('anything'));
});

test('sizes read like Explorer', () => {
  assert.strictEqual(formatSize(0), '0 B');
  assert.strictEqual(formatSize(1023), '1023 B');
  assert.strictEqual(formatSize(1536), '1.5 KB');
  assert.strictEqual(formatSize(10 * 1024 * 1024), '10 MB');
  assert.strictEqual(formatSize(250 * 1024 ** 3), '250 GB');
});

test('sorting: folders first, natural order, both directions', () => {
  const e = (name, dir = false, size = 0, mtime = 0) => ({ name, path: 'C:\\' + name, dir, size, mtime, ctime: 0, ext: dir ? '' : extOf(name), hidden: false, link: false, readonly: false });
  const list = [e('file10.txt', false, 5), e('file2.txt', false, 50), e('Zeta', true), e('alpha', true)];
  assert.deepStrictEqual(sortEntries(list, 'name', 1, true).map(x => x.name), ['alpha', 'Zeta', 'file2.txt', 'file10.txt']);
  assert.deepStrictEqual(sortEntries(list, 'name', -1, true).map(x => x.name), ['Zeta', 'alpha', 'file10.txt', 'file2.txt']);
  assert.deepStrictEqual(sortEntries(list, 'size', -1, false).map(x => x.name).slice(0, 2), ['file2.txt', 'file10.txt']);
});

test('file kinds and extensions', () => {
  assert.strictEqual(kindOf({ dir: true, ext: '' }), 'folder');
  assert.strictEqual(kindOf({ dir: false, ext: 'PNG' }), 'image');
  assert.strictEqual(kindOf({ dir: false, ext: 'docx' }), 'word');
  assert.strictEqual(kindOf({ dir: false, ext: 'weird' }), 'file');
  assert.strictEqual(extOf('.gitignore'), '');
  assert.strictEqual(extOf('archive.tar.gz'), 'gz');
  assert.strictEqual(displayName({ name: 'a.txt', dir: false }, false), 'a');
  assert.strictEqual(displayName({ name: 'my.folder', dir: true }, false), 'my.folder');
});

test('settings are cleaned up', () => {
  const s = sanitize({ theme: 'neon', view: 'grid', iconSize: 'huge', sidebarWidth: 9999, sortDir: -5, pinned: ['C:\\x', 3, ''], language: 'nl' });
  assert.strictEqual(s.theme, 'system');
  assert.strictEqual(s.view, 'grid');
  assert.strictEqual(s.iconSize, 'medium');
  assert.strictEqual(s.sidebarWidth, 480);
  assert.strictEqual(s.sortDir, -1);
  assert.deepStrictEqual(s.pinned, ['C:\\x']);
  assert.strictEqual(s.language, 'nl');
});
