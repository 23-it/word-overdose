// bgm.js — BGMシーケンサー（Phase 1: スタブ）。Phase 3でジェネレーティブ実装。
// レイヤーはコンボ/FEVER状態に連動して増減する。

export function startBgm() {}
export function stopBgm() {}
// layer: 0..3（コンボ段階に対応）。game側から状態変化時に呼ぶ。
export function setBgmLayer(layer) {}
export function setFever(on) {}
export function duckForMiss() {} // ミス時のフィルター落とし
