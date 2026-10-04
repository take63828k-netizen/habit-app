import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../js/logic.js');

const file = (over) => JSON.stringify(Object.assign({ app: 'seikatsu-habit', version: 1, data: L.defaults() }, over));

// --- バックアップ形式の版
test('version: 版 1 は読める', () => {
  assert.equal(L.importData(file({})).error, null);
});
test('version: 未知の新しい版（2）は拒否し、案内に「新しい版」と書く', () => {
  const r = L.importData(file({ version: 2 }));
  assert.ok(r.error);
  assert.match(r.error, /新しい版/);
  assert.equal(r.data, null);
});
test('version: 版が無いファイルは拒否', () => {
  const o = JSON.parse(file({}));
  delete o.version;
  assert.match(L.importData(JSON.stringify(o)).error, /版/);
});
test('version: 版が 0・文字列・小数は拒否', () => {
  for (const v of [0, '1', 1.5, null, -1]) {
    assert.ok(L.importData(file({ version: v })).error, 'version=' + JSON.stringify(v));
  }
});
test('version: 版の検査は中身の検査より先（新しい版は中身が不正でも「新しい版」と案内）', () => {
  const r = L.importData(JSON.stringify({ app: 'seikatsu-habit', version: 9, data: { points: 'x' } }));
  assert.match(r.error, /新しい版/);
});
test('version: 書き出しは現在の版を書く', () => {
  assert.equal(JSON.parse(L.exportData(L.defaults())).version, L.BACKUP_VERSION);
  assert.equal(L.BACKUP_VERSION, 1);
});
