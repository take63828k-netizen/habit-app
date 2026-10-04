import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../js/logic.js');

// --- todayKey: 端末の現地日付で取る（UTCにしない）
test('todayKey: 現地の午前7時は、その日の日付になる', () => {
  assert.equal(L.todayKey(new Date(2026, 9, 4, 7, 0, 0)), '2026-10-04');
});
test('todayKey: 現地の23:59 も、その日の日付', () => {
  assert.equal(L.todayKey(new Date(2026, 0, 5, 23, 59, 0)), '2026-01-05');
});
test('todayKey: 月日は0埋め', () => {
  assert.equal(L.todayKey(new Date(2026, 2, 1, 12)), '2026-03-01');
});

// --- escapeHtml
test('escapeHtml: 記号を無害化する', () => {
  assert.equal(L.escapeHtml('a"b<c>&\'d'), 'a&quot;b&lt;c&gt;&amp;&#39;d');
});
test('escapeHtml: 数値も文字列として受ける', () => {
  assert.equal(L.escapeHtml(5), '5');
});

// --- calcEarnedPoints: 今日を除いた過去の最高点と比べる
const hist = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { totalScore: v }]));

test('points: 初回の記録は最高更新で3pt（0点を除く）', () => {
  assert.deepEqual(L.calcEarnedPoints({}, '2026-10-04', 60), { earned: 3, isNewMax: true });
});
test('points: 0点は最高更新でも付かない', () => {
  assert.deepEqual(L.calcEarnedPoints({}, '2026-10-04', 0), { earned: 0, isNewMax: false });
});
test('points: 過去最高を超えれば3pt', () => {
  assert.equal(L.calcEarnedPoints(hist({ '2026-10-03': 80 }), '2026-10-04', 90).earned, 3);
});
test('points: 最高以下で90%以上は2pt', () => {
  assert.equal(L.calcEarnedPoints(hist({ '2026-10-03': 100 }), '2026-10-04', 95).earned, 2);
});
test('points: 最高以下で80%以上は1pt', () => {
  assert.equal(L.calcEarnedPoints(hist({ '2026-10-03': 100 }), '2026-10-04', 85).earned, 1);
});
test('points: 境界 90→2pt, 89→1pt, 80→1pt, 79→0pt', () => {
  const h = hist({ '2026-10-03': 100 });
  const e = (s) => L.calcEarnedPoints(h, '2026-10-04', s).earned;
  assert.deepEqual([e(90), e(89), e(80), e(79)], [2, 1, 1, 0]);
});
test('points: 80%未満で最高でなければ0pt', () => {
  assert.equal(L.calcEarnedPoints(hist({ '2026-10-03': 100 }), '2026-10-04', 79).earned, 0);
});
test('points: 今日の記録が履歴の途中にあっても、今日だけを除いて比べる', () => {
  // 今日(10-04)が先頭に入っていて、後ろに過去(10-03)がある並び。最後の要素を除く旧実装だと 10-03 を落とす
  const h = { '2026-10-04': { totalScore: 50 }, '2026-10-03': { totalScore: 100 } };
  assert.equal(L.calcEarnedPoints(h, '2026-10-04', 95).earned, 2);
});

// --- parseSaved: 壊れたデータは黙って捨てない
test('parseSaved: 保存なしは初期値で、エラーなし', () => {
  const r = L.parseSaved(null);
  assert.equal(r.error, null);
  assert.equal(r.data, null);
});
test('parseSaved: 壊れたJSONは error を返し、原文を渡す', () => {
  const r = L.parseSaved('{broken');
  assert.ok(r.error);
  assert.equal(r.raw, '{broken');
  assert.equal(r.data, null);
});
test('parseSaved: 欠けた項目は初期値で補う', () => {
  const r = L.parseSaved(JSON.stringify({ points: 7 }));
  assert.equal(r.error, null);
  assert.equal(r.data.points, 7);
  assert.ok(Array.isArray(r.data.goals) && r.data.goals.length > 0);
  assert.deepEqual(r.data.history, {});
  assert.equal(r.data.brightness, 40);
});
test('parseSaved: 型が違う項目（goals が配列でない）は error', () => {
  const r = L.parseSaved(JSON.stringify({ goals: 'x' }));
  assert.ok(r.error);
});
test('parseSaved: JSONとして正しいが null は error', () => {
  assert.ok(L.parseSaved('null').error);
});

// --- exportData / importData
test('importData: 書き出したものを読み戻せる', () => {
  const d = L.defaults();
  d.points = 12;
  const r = L.importData(L.exportData(d));
  assert.equal(r.error, null);
  assert.equal(r.data.points, 12);
});
test('importData: 別アプリのファイルは拒否する', () => {
  assert.ok(L.importData(JSON.stringify({ app: 'other', data: {} })).error);
});
test('importData: 壊れたファイルは拒否する', () => {
  assert.ok(L.importData('nope').error);
});
