import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../js/logic.js');

const hist = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { totalScore: v }]));
const e = (h, s) => L.calcEarnedPoints(h, '2026-10-04', s);

// --- ポイント規則B: 過去最高と「並んだ日」も3pt
test('ruleB: 過去最高と同点は3pt', () => {
  assert.deepEqual(e(hist({ '2026-10-03': 100 }), 100), { earned: 3, isNewMax: true });
});
test('ruleB: 過去最高と同点（80%台）も3pt', () => {
  assert.equal(e(hist({ '2026-10-03': 85 }), 85).earned, 3);
});
test('ruleB: 過去最高より1低いと3ptにならない', () => {
  assert.equal(e(hist({ '2026-10-03': 100 }), 99).earned, 2);
});
test('ruleB: 同点でも0点は付かない', () => {
  assert.equal(e(hist({ '2026-10-03': 0 }), 0).earned, 0);
});
test('ruleB: 最高が複数日あっても、最大値と並べば3pt', () => {
  assert.equal(e(hist({ '2026-10-01': 100, '2026-10-02': 60, '2026-10-03': 100 }), 100).earned, 3);
});
test('ruleB: 今日の古い記録は比べる相手にしない', () => {
  assert.equal(e(hist({ '2026-10-04': 100, '2026-10-03': 70 }), 80).earned, 3);
});

// --- 評価: 初期値は未選択。全項目を選ぶまで平均は出ない
test('eval: 何も選んでいなければ null', () => {
  assert.equal(L.evalAverage([1, 2, 3], {}), null);
});
test('eval: 1つでも未選択なら null', () => {
  assert.equal(L.evalAverage([1, 2, 3], { 1: 100, 2: 50 }), null);
});
test('eval: 全項目を選べば平均（四捨五入）', () => {
  assert.equal(L.evalAverage([1, 2, 3], { 1: 100, 2: 50, 3: 0 }), 50);
  assert.equal(L.evalAverage([1, 2, 3], { 1: 100, 2: 100, 3: 50 }), 83);
});
test('eval: 小数は切り捨てでなく四捨五入（66.67→67）', () => {
  assert.equal(L.evalAverage([1, 2, 3], { 1: 100, 2: 100, 3: 0 }), 67);
});
test('eval: 削除済みの目標の選択は数えない', () => {
  assert.equal(L.evalAverage([1], { 1: 100, 9: 0 }), 100);
});
test('eval: 0点の選択は「選択済み」として扱う', () => {
  assert.equal(L.evalAverage([1, 2], { 1: 0, 2: 0 }), 0);
});
test('eval: 目標が0件なら null', () => {
  assert.equal(L.evalAverage([], {}), null);
});
test('eval: 100・50・0 以外の値は未選択扱い', () => {
  assert.equal(L.evalAverage([1], { 1: 75 }), null);
});

// --- iPhone のブラウザタブか
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
test('iosTab: iPhone のタブは true', () => {
  assert.equal(L.isIosBrowserTab(IOS, false, 0), true);
});
test('iosTab: iPhone でもホーム画面から開いていれば false', () => {
  assert.equal(L.isIosBrowserTab(IOS, true, 0), false);
});
test('iosTab: 旧形式の iPad の UA も true（Mac を名乗らない）', () => {
  assert.equal(L.isIosBrowserTab('Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15', false, 0), true);
});
test('iosTab: Android は false', () => {
  assert.equal(L.isIosBrowserTab(ANDROID, false, 5), false);
});
test('iosTab: Mac の UA でもタッチ点が複数なら iPad とみなして true', () => {
  assert.equal(L.isIosBrowserTab(IPAD, false, 5), true);
});
test('iosTab: タッチ点が0の Mac は false', () => {
  assert.equal(L.isIosBrowserTab(IPAD, false, 0), false);
});
