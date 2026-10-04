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
  function normalize(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return { data: null, error: '保存データの形が不正です' };
    const d = defaults();
    if ('goals' in obj && !Array.isArray(obj.goals)) return { data: null, error: 'goals が配列ではありません' };
    if ('rewards' in obj && !Array.isArray(obj.rewards)) return { data: null, error: 'rewards が配列ではありません' };
    if ('history' in obj && (obj.history === null || typeof obj.history !== 'object' || Array.isArray(obj.history))) {
      return { data: null, error: 'history の形が不正です' };
    }
    const out = Object.assign({}, d, obj);
    if (out.goals.length === 0) out.goals = d.goals;
    return { data: out, error: null };
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
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HabitLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
