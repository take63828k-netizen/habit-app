// 画面に依存しない処理。ブラウザではグローバル HabitLogic、Node では module.exports で使う。
(function (root) {
  const STORAGE_KEY = 'seikatsu_habit_app_data';
  const APP_ID = 'seikatsu-habit';

  function defaults() {
    return {
      goals: [
        { id: 1, title: '21:30までに寝る' },
        { id: 2, title: '勉強を30分する' },
        { id: 3, title: '朝起きてコップ一杯の水を飲む' },
      ],
      rewards: [
        { id: 1, title: 'お気に入りのケーキを食べる', cost: 5 },
        { id: 2, title: '好きな映画を1本見る', cost: 8 },
        { id: 3, title: 'ちょっと豪華なランチ', cost: 12 },
      ],
      points: 0,
      history: {},
      wallpaper: 'img/wallpaper.jpg',
      brightness: 40,
      exchanges: [],      // ご褒美の交換履歴 { date, title, cost }（最新200件）
      lastBackup: null,   // 最後にバックアップを書き出した日
      createdAt: todayKey(),
    };
  }

  // 端末の現地日付（UTC ではない。日本の0〜9時が前日にならない）
  function todayKey(d) {
    d = d || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 今日の記録を除いた過去の最高点と比べて、獲得ポイントを決める
  function calcEarnedPoints(history, today, finalScore) {
    const past = Object.keys(history || {})
      .filter((k) => k !== today)
      .map((k) => history[k].totalScore);
    const maxPast = past.length > 0 ? Math.max.apply(null, past) : 0;
    const isNewMax = (past.length === 0 || finalScore > maxPast) && finalScore > 0;
    let earned = 0;
    if (isNewMax) earned = 3;
    else if (finalScore >= 90) earned = 2;
    else if (finalScore >= 80) earned = 1;
    return { earned: earned, isNewMax: isNewMax };
  }

  // 欠けた項目は初期値で補う。型が違う・壊れているときは黙って捨てず error を返す
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
  const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const MAX_EXCHANGES = 200;

  // 壁紙に使ってよい文字列だけ返す。使えなければ null
  // https のURL、同梱の img/ 配下、data:image の3種類。引用符・括弧・空白・バックスラッシュは拒否
  function safeWallpaper(url) {
    if (typeof url !== 'string') return null;
    if (/^https:\/\/[^\s'"()\\]+$/.test(url)) return url;
    if (/^img\/[A-Za-z0-9._\-\/]+$/.test(url)) return url;
    if (/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(url)) return url;
    return null;
  }

  // 中身の型と範囲を検査する。問題があれば最初の1件の説明（項目名を含む）を返し、なければ null
  function validate(d) {
    if (!isInt(d.points) || d.points < 0) return 'points が0以上の整数ではありません';
    if (!Array.isArray(d.goals)) return 'goals が配列ではありません';
    const gids = new Set();
    for (const g of d.goals) {
      if (!isObj(g) || typeof g.id !== 'number' || !isNonEmptyStr(g.title)) return 'goals に不正な行があります';
      if (gids.has(g.id)) return 'goals の id が重複しています';
      gids.add(g.id);
    }
    if (!Array.isArray(d.rewards)) return 'rewards が配列ではありません';
    const rids = new Set();
    for (const r of d.rewards) {
      if (!isObj(r) || typeof r.id !== 'number' || !isNonEmptyStr(r.title) || !isInt(r.cost) || r.cost <= 0) return 'rewards に不正な行があります';
      if (rids.has(r.id)) return 'rewards の id が重複しています';
      rids.add(r.id);
    }
    if (!isObj(d.history)) return 'history の形が不正です';
    for (const k of Object.keys(d.history)) {
      const h = d.history[k];
      if (!DATE_RE.test(k)) return 'history に日付でないキーがあります';
      if (!isObj(h) || typeof h.totalScore !== 'number' || !(h.totalScore >= 0 && h.totalScore <= 100) || !isObj(h.scores)) {
        return 'history の ' + k + ' の中身が不正です';
      }
    }
    if (typeof d.brightness !== 'number' || !(d.brightness >= 0 && d.brightness <= 85)) return 'brightness が0〜85ではありません';
    if (safeWallpaper(d.wallpaper) === null) return 'wallpaper の指定が使えない形です';
    if (!Array.isArray(d.exchanges)) return 'exchanges が配列ではありません';
    for (const e of d.exchanges) {
      if (!isObj(e) || !DATE_RE.test(e.date) || !isNonEmptyStr(e.title) || !isInt(e.cost) || e.cost <= 0) return 'exchanges に不正な行があります';
    }
    if (d.lastBackup !== null && !DATE_RE.test(d.lastBackup)) return 'lastBackup が日付ではありません';
    if (!DATE_RE.test(d.createdAt)) return 'createdAt が日付ではありません';
    return null;
  }

  function normalize(obj) {
    if (!isObj(obj)) return { data: null, error: '保存データの形が不正です' };
    const out = Object.assign({}, defaults(), obj);
    if (Array.isArray(out.goals) && out.goals.length === 0) out.goals = defaults().goals;
    const err = validate(out);
    if (err) return { data: null, error: err };
    return { data: out, error: null };
  }

  // 交換した結果の新しいデータを返す（元は変えない）
  function exchangeReward(data, rewardId, today) {
    const r = data.rewards.find((x) => x.id === rewardId);
    if (!r) return { data: null, error: 'ご褒美が見つかりません' };
    if (data.points < r.cost) return { data: null, error: 'ポイントが足りません' };
    const exchanges = data.exchanges.concat([{ date: today, title: r.title, cost: r.cost }]).slice(-MAX_EXCHANGES);
    return { data: Object.assign({}, data, { points: data.points - r.cost, exchanges: exchanges }), error: null };
  }

  function daysBetween(a, b) {
    const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    return Math.round((t(b) - t(a)) / 86400000);
  }

  // 最終バックアップ（無ければ作成日）から14日以上たっていれば true
  function needsBackupReminder(data, today) {
    const base = data.lastBackup || data.createdAt;
    return daysBetween(base, today) >= 14;
  }

  function parseSaved(raw) {
    if (raw === null || raw === undefined) return { data: null, error: null, raw: null };
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { return { data: null, error: 'JSONを読めません', raw: raw }; }
    const r = normalize(obj);
    return { data: r.data, error: r.error, raw: raw };
  }

  function exportData(data) {
    return JSON.stringify({ app: APP_ID, version: 1, exportedAt: new Date().toISOString(), data: data }, null, 2);
  }

  function importData(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { data: null, error: 'ファイルを読めません' }; }
    if (!obj || obj.app !== APP_ID) return { data: null, error: 'このアプリのバックアップではありません' };
    return normalize(obj.data);
  }

  const api = {
    STORAGE_KEY: STORAGE_KEY, defaults: defaults, todayKey: todayKey, escapeHtml: escapeHtml,
    calcEarnedPoints: calcEarnedPoints, parseSaved: parseSaved, exportData: exportData, importData: importData,
    safeWallpaper: safeWallpaper, exchangeReward: exchangeReward, needsBackupReminder: needsBackupReminder,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HabitLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
