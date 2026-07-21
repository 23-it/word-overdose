// quiz.js — 出題ロジック（純ロジック、DOM非依存）
//
// - プレイヤーレベルに応じた出題レベル帯を選ぶ
// - 誤答は同レベル帯の他単語の訳から3つ（正解と重複しない）
// - 単語成績（stats）で出題重みを調整: 間違えた単語↑、高正解率↓

// プレイヤーレベル → 出題対象の単語レベル帯（1..5）。
// 低レベルは易しい語中心、上がるにつれ上位帯が解禁される。
export function levelBandForPlayer(playerLevel) {
  if (playerLevel >= 40) return [3, 4, 5];
  if (playerLevel >= 25) return [2, 3, 4, 5];
  if (playerLevel >= 12) return [1, 2, 3, 4];
  if (playerLevel >= 5) return [1, 2, 3];
  return [1, 2];
}

// 単語1件の出題重み。stats[en] = { seen, correct } を参照。
//   - 未出題は基準より少し高め（新規を出しやすく）
//   - 正解率が低いほど重い（復習を出しやすく）
export function weightForWord(word, stats) {
  const s = stats && stats[word.en];
  if (!s || !s.seen) return 1.5; // 未出題は優先的に
  const accuracy = s.correct / s.seen;
  // accuracy 0 → 3.0、accuracy 1 → 0.6 くらいに写像
  return 0.6 + (1 - accuracy) * 2.4;
}

// 重み付き抽選（rng: () => [0,1)）。重複を避けつつ count 件選ぶ。
export function weightedSample(items, weights, count, rng = Math.random) {
  const pool = items.map((item, i) => ({ item, w: weights[i] }));
  const picked = [];
  for (let n = 0; n < count && pool.length > 0; n++) {
    const total = pool.reduce((a, b) => a + b.w, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    if (idx >= pool.length) idx = pool.length - 1;
    picked.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return picked;
}

// 1問分を生成。{ word, choices: string[4], answerIndex }
export function buildQuestion(word, pool, rng = Math.random) {
  // 同レベル帯（±1帯）から誤答候補を集める。正解の訳と同一表記は除外。
  const near = pool.filter(
    (w) => w.en !== word.en && Math.abs(w.level - word.level) <= 1 && w.ja !== word.ja
  );
  const fallback = pool.filter((w) => w.en !== word.en && w.ja !== word.ja);
  const source = near.length >= 3 ? near : fallback;

  const distractors = weightedSample(
    source,
    source.map(() => 1),
    3,
    rng
  ).map((w) => w.ja);

  const choices = shuffle([word.ja, ...distractors], rng);
  return {
    word,
    choices,
    answerIndex: choices.indexOf(word.ja),
  };
}

// セッションの出題リストを生成。count 問ぶん、重み付きで単語を選ぶ。
export function buildSession(pool, { playerLevel = 1, stats = {}, count = 20, rng = Math.random } = {}) {
  const band = levelBandForPlayer(playerLevel);
  let candidates = pool.filter((w) => band.includes(w.level));
  if (candidates.length < count) candidates = pool.slice();

  const weights = candidates.map((w) => weightForWord(w, stats));
  const words = weightedSample(candidates, weights, Math.min(count, candidates.length), rng);
  return words.map((w) => buildQuestion(w, pool, rng));
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
