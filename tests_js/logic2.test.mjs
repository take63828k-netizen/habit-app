import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../js/logic.js');

const good = () => L.defaults();
const withMut = (f) => { const d = good(); f(d); return L.importData(L.exportData(d)); };

// --- 深い検査（データを取り込む前に、中身の型と範囲を見る）
test('deep: 初期データは通る', () => {
  assert.equal(L.importData(L.exportData(good())).error, null);
});
test('deep: points が文字列は拒否', () => {
  assert.match(withMut((d) => { d.points = '5'; }).error, /points/);
});
test('deep: points が負は拒否', () => {
  assert.match(withMut((d) => { d.points = -1; }).error, /points/);
});
test('deep: points が小数は拒否', () => {
  assert.match(withMut((d) => { d.points = 1.5; }).error, /points/);
});
test('deep: goal の title が空は拒否', () => {
  assert.match(withMut((d) => { d.goals[0].title = ''; }).error, /goals/);
});
test('deep: goal の id が重複は拒否', () => {
  assert.match(withMut((d) => { d.goals[1].id = d.goals[0].id; }).error, /goals/);
});
test('deep: reward の cost が0以下は拒否', () => {
  assert.match(withMut((d) => { d.rewards[0].cost = 0; }).error, /rewards/);
});
test('deep: history の totalScore が無いと拒否', () => {
  assert.match(withMut((d) => { d.history['2026-10-01'] = { scores: {} }; }).error, /history/);
});
test('deep: history の totalScore が範囲外(101)は拒否', () => {
  assert.match(withMut((d) => { d.history['2026-10-01'] = { scores: {}, totalScore: 101 }; }).error, /history/);
});
test('deep: history の totalScore が範囲外(-1)は拒否', () => {
  assert.match(withMut((d) => { d.history['2026-10-01'] = { scores: {}, totalScore: -1 }; }).error, /history/);
});
test('deep: history の totalScore が 0 と 100 は通る（境界）', () => {
  const r = withMut((d) => {
    d.history['2026-10-01'] = { scores: {}, totalScore: 0 };
    d.history['2026-10-02'] = { scores: {}, totalScore: 100 };
  });
  assert.equal(r.error, null);
});
test('deep: exchanges の cost が0は拒否', () => {
  assert.match(withMut((d) => { d.exchanges = [{ date: '2026-10-01', title: 'x', cost: 0 }]; }).error, /exchanges/);
});
test('deep: lastBackup が日付でない文字列は拒否', () => {
  assert.match(withMut((d) => { d.lastBackup = 'yesterday'; }).error, /lastBackup/);
});
test('deep: lastBackup が日付なら通る', () => {
  assert.equal(withMut((d) => { d.lastBackup = '2026-10-01'; }).error, null);
});
test('deep: history のキーが日付形式でないと拒否', () => {
  assert.match(withMut((d) => { d.history['yesterday'] = { scores: {}, totalScore: 50 }; }).error, /history/);
});
test('deep: history の scores が配列は拒否', () => {
  assert.match(withMut((d) => { d.history['2026-10-01'] = { scores: [], totalScore: 50 }; }).error, /history/);
});
test('deep: brightness が範囲外(86)は拒否', () => {
  assert.match(withMut((d) => { d.brightness = 86; }).error, /brightness/);
});
test('deep: 正しい履歴は通る', () => {
  const r = withMut((d) => { d.history['2026-10-01'] = { scores: { 1: 100 }, totalScore: 100 }; });
  assert.equal(r.error, null);
  assert.equal(r.data.history['2026-10-01'].totalScore, 100);
});
test('deep: exchanges の形が不正は拒否', () => {
  assert.match(withMut((d) => { d.exchanges = [{ date: '2026-10-01', title: 'x' }]; }).error, /exchanges/);
});
test('deep: 古いデータ（createdAt・exchanges 無し）は補って通る', () => {
  const r = L.parseSaved(JSON.stringify({ points: 3 }));
  assert.equal(r.error, null);
  assert.deepEqual(r.data.exchanges, []);
  assert.match(r.data.createdAt, /^\d{4}-\d{2}-\d{2}$/);
});

// --- safeWallpaper
test('wallpaper: https のURLは通る', () => {
  assert.equal(L.safeWallpaper('https://example.com/a.jpg'), 'https://example.com/a.jpg');
});
test('wallpaper: 同梱の相対パスは通る', () => {
  assert.equal(L.safeWallpaper('img/wallpaper.jpg'), 'img/wallpaper.jpg');
});
test('wallpaper: data:image/jpeg は通る', () => {
  assert.equal(L.safeWallpaper('data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA');
});
test('wallpaper: javascript: は拒否', () => {
  assert.equal(L.safeWallpaper('javascript:alert(1)'), null);
});
test('wallpaper: http（暗号化なし）は拒否', () => {
  assert.equal(L.safeWallpaper('http://example.com/a.jpg'), null);
});
test('wallpaper: 引用符を含むURLは拒否', () => {
  assert.equal(L.safeWallpaper("https://e.com/a.jpg')x"), null);
});
test('wallpaper: 空白を含むURLは拒否', () => {
  assert.equal(L.safeWallpaper('https://e.com/a b.jpg'), null);
});
test('wallpaper: 改行を含むURLは拒否', () => {
  assert.equal(L.safeWallpaper('https://e.com/a\n.jpg'), null);
});
test('wallpaper: data:text/html は拒否', () => {
  assert.equal(L.safeWallpaper('data:text/html;base64,AAAA'), null);
});
test('wallpaper: data:image/svg+xml・data:image/html は拒否', () => {
  assert.equal(L.safeWallpaper('data:image/svg+xml;base64,AAAA'), null);
  assert.equal(L.safeWallpaper('data:image/html;base64,AAAA'), null);
});
test('wallpaper: 括弧・バックスラッシュを含むURLは拒否', () => {
  assert.equal(L.safeWallpaper('https://e.com/a(1).jpg'), null);
  assert.equal(L.safeWallpaper('https://e.com/a\\b.jpg'), null);
  assert.equal(L.safeWallpaper('https://e.com/a"b.jpg'), null);
});
test('wallpaper: 取り込みデータの壁紙が不正なら拒否', () => {
  assert.match(withMut((d) => { d.wallpaper = 'javascript:alert(1)'; }).error, /wallpaper/);
});

// --- exchangeReward（純粋関数）
test('exchange: ポイントを引き、履歴に記録する', () => {
  const d = good(); d.points = 10;
  const r = L.exchangeReward(d, 1, '2026-10-04');
  assert.equal(r.error, null);
  assert.equal(r.data.points, 5);
  assert.deepEqual(r.data.exchanges[r.data.exchanges.length - 1], { date: '2026-10-04', title: d.rewards[0].title, cost: 5 });
});
test('exchange: 元のデータは変えない', () => {
  const d = good(); d.points = 10;
  L.exchangeReward(d, 1, '2026-10-04');
  assert.equal(d.points, 10);
  assert.equal(d.exchanges.length, 0);
});
test('exchange: ポイント不足は拒否', () => {
  const d = good(); d.points = 4;
  assert.ok(L.exchangeReward(d, 1, '2026-10-04').error);
});
test('exchange: ちょうど足りれば通る（境界）', () => {
  const d = good(); d.points = 5;
  const r = L.exchangeReward(d, 1, '2026-10-04');
  assert.equal(r.error, null);
  assert.equal(r.data.points, 0);
});
test('exchange: 存在しないご褒美は拒否', () => {
  const d = good(); d.points = 99;
  assert.ok(L.exchangeReward(d, 999, '2026-10-04').error);
});
test('exchange: 履歴は最新200件までに絞る', () => {
  const d = good(); d.points = 1000;
  d.exchanges = Array.from({ length: 200 }, (_, i) => ({ date: '2026-01-01', title: 'old' + i, cost: 1 }));
  const r = L.exchangeReward(d, 1, '2026-10-04');
  assert.equal(r.data.exchanges.length, 200);
  assert.equal(r.data.exchanges[0].title, 'old1');
});

// --- バックアップ催促
test('reminder: 最終バックアップから13日はまだ出さない', () => {
  assert.equal(L.needsBackupReminder({ lastBackup: '2026-09-21', createdAt: '2026-01-01' }, '2026-10-04'), false);
});
test('reminder: 14日で出す（境界）', () => {
  assert.equal(L.needsBackupReminder({ lastBackup: '2026-09-20', createdAt: '2026-01-01' }, '2026-10-04'), true);
});
test('reminder: 一度もバックアップが無ければ作成日から数える', () => {
  assert.equal(L.needsBackupReminder({ lastBackup: null, createdAt: '2026-09-25' }, '2026-10-04'), false);
  assert.equal(L.needsBackupReminder({ lastBackup: null, createdAt: '2026-09-20' }, '2026-10-04'), true);
});
test('reminder: 月またぎの日数も正しく数える', () => {
  assert.equal(L.needsBackupReminder({ lastBackup: '2026-09-30', createdAt: '2026-01-01' }, '2026-10-13'), false);
  assert.equal(L.needsBackupReminder({ lastBackup: '2026-09-30', createdAt: '2026-01-01' }, '2026-10-14'), true);
});
