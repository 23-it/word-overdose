// storage.js — localStorage永続化（DOM非依存、storage/Date は注入可能）
//
// 保持データ: XP/レベル、デイリーストリーク、ランキングTop10、単語成績、設定。
// キーは全て "dopagaki:" プレフィックス。

const PREFIX = 'dopagaki:';
const K = {
  progress: PREFIX + 'progress', // { xp, level }
  streak: PREFIX + 'streak', // { count, lastDate }
  ranking: PREFIX + 'ranking', // [{ score, rank, date }]
  wordStats: PREFIX + 'wordStats', // { [en]: { seen, correct } }
  settings: PREFIX + 'settings', // { bgmVolume, sfxVolume, muted, effectIntensity }
};

export const DEFAULT_SETTINGS = {
  bgmVolume: 0.7,
  sfxVolume: 0.9,
  muted: false,
  effectIntensity: 'full', // 'full' | 'reduced'
};

// レベルアップに必要なXP（累積ではなく「そのレベルで必要な量」）。
export function xpToNext(level) {
  return 100 + (level - 1) * 60;
}

// 総XPからレベルと現レベル内進捗を算出。
export function levelFromXp(totalXp) {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level += 1;
  }
  return { level, xpInLevel: remaining, xpForLevel: xpToNext(level) };
}

// レベル称号。
export const TITLES = [
  { min: 50, title: 'VOCAB OVERLORD' },
  { min: 40, title: 'ワードマスター' },
  { min: 30, title: '語彙の化身' },
  { min: 20, title: '単語ハンター' },
  { min: 12, title: '語彙見習い' },
  { min: 5, title: '単語かじり' },
  { min: 1, title: '単語の卵' },
];

export function titleForLevel(level) {
  for (const t of TITLES) if (level >= t.min) return t.title;
  return TITLES[TITLES.length - 1].title;
}

// ローカル日付キー "YYYY-MM-DD"（タイムゾーン依存でその日の境界）。
export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 2つの日付キーの日数差。
export function dayDiff(fromKey, toKey) {
  const a = new Date(fromKey + 'T00:00:00');
  const b = new Date(toKey + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// storage: localStorage 互換（getItem/setItem）。now: Date を返す関数。
export class Store {
  constructor(storage = globalThis.localStorage, now = () => new Date()) {
    this.storage = storage;
    this.now = now;
  }

  _read(key, fallback) {
    try {
      const raw = this.storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  _write(key, value) {
    this.storage.setItem(key, JSON.stringify(value));
  }

  // --- 設定 ---
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...this._read(K.settings, {}) };
  }
  setSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    this._write(K.settings, next);
    return next;
  }

  // --- 進行（XP/レベル） ---
  getProgress() {
    const p = this._read(K.progress, { xp: 0 });
    const info = levelFromXp(p.xp);
    return { xp: p.xp, ...info, title: titleForLevel(info.level) };
  }
  addXp(amount) {
    const before = this.getProgress();
    const xp = before.xp + Math.max(0, Math.round(amount));
    this._write(K.progress, { xp });
    const after = this.getProgress();
    return { before, after, leveledUp: after.level > before.level, gained: amount };
  }

  // --- ストリーク ---
  getStreak() {
    return this._read(K.streak, { count: 0, lastDate: null });
  }
  // プレイ完了時に呼ぶ。同日=据置、翌日=+1、それ以上空き=1にリセット。
  recordPlay() {
    const today = dateKey(this.now());
    const s = this.getStreak();
    if (s.lastDate === today) {
      // 同日再プレイ: 変化なし
    } else if (s.lastDate && dayDiff(s.lastDate, today) === 1) {
      s.count += 1;
    } else {
      s.count = 1;
    }
    s.lastDate = today;
    this._write(K.streak, s);
    return s;
  }

  // --- ランキング ---
  getRanking() {
    return this._read(K.ranking, []);
  }
  submitScore(score, rank) {
    const list = this.getRanking();
    const bestBefore = list.length ? Math.max(...list.map((e) => e.score)) : 0;
    const entry = { score, rank, date: dateKey(this.now()) };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, 10);
    this._write(K.ranking, top);
    return { top, isNewRecord: score > bestBefore, rankPosition: top.indexOf(entry) };
  }

  // --- 単語成績 ---
  getWordStats() {
    return this._read(K.wordStats, {});
  }
  recordWord(en, wasCorrect) {
    const stats = this.getWordStats();
    const s = stats[en] || { seen: 0, correct: 0 };
    s.seen += 1;
    if (wasCorrect) s.correct += 1;
    stats[en] = s;
    this._write(K.wordStats, stats);
    return stats;
  }

  resetAll() {
    for (const key of Object.values(K)) this.storage.removeItem(key);
  }
}
