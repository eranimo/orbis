import RandomJS from 'random-js';

export default class Random {
  constructor(seed) {
    this.engine = RandomJS.engines.mt19937();
    if (seed) {
      this.seed = seed;
      this.engine.seed(seed);
    } else {
      this.engine.autoSeed();
    }
  }

  randomInt(max) {
    return RandomJS.integer(0, max)(this.engine);
  }

  random() {
    return RandomJS.real(0, 1)(this.engine);
  }

  real(from, to, inclusive = false) {
    return RandomJS.real(from, to, inclusive)(this.engine);
  }
}
