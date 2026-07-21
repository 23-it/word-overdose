// particles.js — パーティクルシステム（Phase 1: プレースホルダ）。Phase 4で実装。

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }
  emit(x, y, opts = {}) {}
  update(dt, ctx) {}
  clear() {
    this.particles = [];
  }
}
