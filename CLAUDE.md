# WORD OVERDOSE — プロジェクト引き継ぎ

ドパガキ（＝刺激に慣れた層）向けの、ドーパミンが出まくる英単語4択クイズPWA。
**演出・音・UIは「やりすぎ」が正義**。地味・無難な方向には寄せないこと。

公開URL: https://23-it.github.io/word-overdose/ （GitHub Pages、main への push で自動デプロイ）

## 技術構成

- **Vanilla JS (ES Modules) + Canvas 2D。ビルド工程なし・依存ゼロ**の静的PWA。
  この方針は維持すること（npm パッケージやバンドラを導入しない）。
- スマホ縦画面（375px）優先。PCでも動く。
- 全データは `localStorage`、キーは `dopagaki:` プレフィックス。

```
index.html / manifest.json / sw.js / css/style.css
js/
  main.js            画面遷移ステートマシン、共有ctx、SW登録、各種配線
  core/              純ロジック（DOM非依存・テスト対象）
    combo.js         コンボ倍率 1x/2x@5/4x@10/8x@20/16x@30、FEVER(20コンボで突入)
    score.js         スコア計算・ランク判定(S/A/B/C)・XP算出
    quiz.js          出題レベル帯・誤答生成・成績連動の出題重み
    storage.js       XP/レベル/称号/ストリーク/ランキング/単語成績/設定
  screens/           home / game / result / settings
  audio/             engine(AudioContext+コンプ) / sfx / bgm  ※全てWebAudio合成、音源ファイル無し
  fx/                canvas(FXループ) / particles / effects(演出オーケストレータ)
  data/words.js      630語 {en, ja, level:1..5}（en は一意）
```

## 現在のデザイン方針（重要）

**ネオン・グラス・テトリス路線**。漆黒ベース × テトリス7色（水色/黄/紫/緑/赤/青/オレンジ）、
透明フロストガラス（backdrop-blur）、**全部が発光**。
※ 過去に「ハイパーポップ(ステッカー)」「黒×金の高級路線」も試したが**却下済み**。戻さないこと。

- **モーションブラー**: `fx/canvas.js` が毎フレーム `destination-out` で薄く消して残像を作る
  （黒で塗らないのでDOMを隠さない）。
- **常時ゆれ**: `fx/effects.js` の `applyDomTransform` が `#app` に毎フレーム transform を付与。
  **BGMのキックに同期**（`bgm.setBeatCallback(effects.beat)` を main.js で配線、頭拍1.2/他0.85）。
- 演出は `effects.celebrate()` 一本に集約。「激アツ度」0〜4で段階的に激しくなる
  （集中線・衝撃波リング・インパクトスター・コインシャワー・紙吹雪・ストロボ・カットイン文字）。
  **毎回の正解が大当り級**の物量になるよう意図的に盛ってある。減らさないこと。
- アクセシビリティ: 設定の `EFFECT INTENSITY: REDUCED` で減光・揺れ/残像OFF。この逃げ道は必ず維持する。

## 音（WebAudio完全合成）

- `sfx.js`: 正解はコンボでペンタトニックを駆け上がるFMベル。5コンボ毎にアルペジオ、
  10コンボ毎にファンファーレ（和音＋シンバル＋大サブ）。ミス/カウントダウン/FEVER/レベルアップ等。
- `bgm.js`: BPM160・16ステップのシーケンサー。**4小節のコード進行 Am-F-C-G**にベース/アシッド/
  リフ/和音/リードが追従。コンボでレイヤー増加（キック→ハット/アシッド→リフ→FEVERリード＋スーパーソウ）。
  ミス時はローパスを一瞬閉じる（DJ風ダック）。
- `engine.js` のマスターにコンプレッサー。レイヤーを増やすときは音量に注意。

## 開発の作法

- テスト: `node --test "js/core/*.test.js"`（23件）。**core を変えたら必ず実行**。
- ローカル確認: `npx serve .` （ビルド不要）。
- **アセットを変えたら `sw.js` の `CACHE_VERSION` を必ず上げる**。上げ忘れると更新が届かない。
  SWは network-first ＋ 新版検知で自動リロードする実装済み。
- コミットは意味単位で。main に push すると数分で Pages に反映。
- JS が参照する id/class を変えない限り、CSS は自由に差し替えてよい（過去の刷新も全てCSS差し替えで完結）。

## 未着手・調整候補

- 揺れの強さ / BPM / 曲調（ハイパーポップ、DnB、フューチャーベース等への寄せ）
- 音色と音量バランスの実機調整
- 実機（スマホ）での操作感・パフォーマンス確認は未実施
