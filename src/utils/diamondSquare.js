import nj from 'numjs';
import _ from 'lodash';
import Random from 'random-js';
import ds from 'datastructures-js';
import nextafter from 'nextafter';

export default class DiamondSquare {

  constructor(options, random) {
    // prepare the grid
    this.finalSize = options.size || 512;
    this.size = this.finalSize / 2 || 256;
    this.roughness = options.roughness || 2;
    this.random = random;
  }

  get(x, y) {
    return this.grid.get(x, y);
  }

  set(x, y, val) {
    this.grid.set(x, y, val);
  }

  generate() {
    const top = this.random.randomInt(255);
    const bottom = this.random.randomInt(255);

    this.grid = nj.zeros([this.size, this.size], 'float32');
    this.grid.set(0, 0, top);
    this.grid.set(this.size - 1, 0, top);
    this.grid.set(0, this.size - 1, bottom);
    this.grid.set(this.size - 1, this.size - 1, bottom);

    this._diamond(0, 0, this.size - 1, this.size - 1);

    this.maxHeight = _.round(this.grid.max());
    this.minHeight = _.round(this.grid.min());
    this.avgHeight = _.round(this.grid.mean());

    // simple erosion
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        this.grid.set(x, y, _.mean([
          this.grid.get(x + 1, y + 1) || 0,
          this.grid.get(x - 1, y - 1) || 0,
          this.grid.get(x - 1, y + 1) || 0,
          this.grid.get(x + 1, y - 1) || 0,
          this.grid.get(x, y + 1) || 0,
          this.grid.get(x + 1, y) || 0,
          this.grid.get(x, y - 1) || 0,
          this.grid.get(x - 1, y) || 0
        ]));
      }
    }

    this.grid = this.grid.T;

    console.time('depression fill');
    this.fillDepressions();
    console.timeEnd('depression fill');
  }

  // gets the x and y coordinate of a cell's 4-neighbor
  // wrapping in all directions
  getNeighbors(x, y) {
    const xPlus = x === this.size - 1 ? 0 : x + 1;
    const xMinus = x === 0 ? this.size - 1 : x - 1;
    const yPlus = y === this.size - 1 ? 0 : y + 1;
    const yMinus = y === 0 ? this.size - 1 : y - 1;
    return [
      [x, yMinus], // north
      [x, yPlus], // south
      [xPlus, y], // east
      [xMinus, y] // west
    ];
  }

  // improved priority-flood from:
  // https://arxiv.org/pdf/1511.04463v1.pdf
  // (algorithm #2 in paper)
  fillDepressions() {
    const open = ds.priorityQueue();
    const pit = ds.queue();
    const closed = nj.zeros([this.size, this.size], 'uint8');

    // add all edges of the map to the priority queue
    // and set them to closed
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        if (x === 0 || x === this.size - 1 || y === 0 || y === this.size - 1) {
          open.enqueue([x, y], this.grid.get(x, y));
          closed.set(x, y, 1);
        }
      }
    }

    // while we still have open or pit cells

    while (!open.isEmpty() || !pit.isEmpty()) {
      let x;
      let y;
      const topPit = pit.front();
      const topOpen = open.front();
      let top;
      if (!open.isEmpty() && !pit.isEmpty() && topOpen[0] === topPit[0] && topOpen[1] === topPit[1]) {
        [x, y] = open.dequeue();
        top = null;
      } else if (!pit.isEmpty()) {
        [x, y] = pit.dequeue();
        if (top === null) {
          top = this.grid.get(x, y);
        }
      } else {
        [x, y] = open.dequeue();
        top = null;
      }
      for (const [nx, ny] of this.getNeighbors(x, y)) {
        if (closed.get(nx, ny)) {
          continue;
        }
        closed.set(nx, ny, 1);
        const next = nextafter(this.grid.get(x, y), Infinity);
        if (this.grid.get(nx, ny) <= next) {
          this.grid.set(nx, ny, next);
          pit.enqueue([nx, ny]);
        } else {
          open.enqueue([nx, ny], this.grid.get(nx, ny));
        }
      }
    }
  }

  _square(xa, ya, x, y, xb, yb) {
    if (this.grid.get(x, y) === 0) {
      const d = Math.abs(xa - xb) + Math.abs(ya - yb);
      let cell = (this.grid.get(xa, ya) + this.grid.get(xb, yb)) / 2;
      cell += this.random.real(-0.5, 0.5) * d * this.roughness;
      if (y === 0) {
        this.grid.set(x, this.size - 1, cell);
      }
      if ((x === 0 || x === this.size - 1) && y < this.size - 1) {
        this.grid.set(x, this.size - 1 - y, cell);
      }
      this.grid.set(x, y, _.clamp(cell, 0, 255));
    }
  }

  _diamond(x1, y1, x2, y2) {
    // if we have more squares
    if (!(x2 - x1 < 2 && y2 - y1 < 2)) {
      // set the center point to be the average of all 4 corners
      const x = Math.floor((x1 + x2) / 2);
      const y = Math.floor((y1 + y2) / 2);
      const centerAvg = Math.floor((
        this.grid.get(x1, y1) + this.grid.get(x2, y1) +
        this.grid.get(x2, y2) + this.grid.get(x1, y2)
      ) / 4);
      this.grid.set(x, y, _.clamp(centerAvg, 0, 255));

      // subdivide the square into 4 parts
      this._square(x1, y1, x, y1, x2, y1);
      this._square(x2, y1, x2, y, x2, y2);
      this._square(x1, y2, x, y2, x2, y2);
      this._square(x1, y1, x1, y, x1, y2);

      // subdivide and perform the diamond part on each subdivided square
      this._diamond(x1, y1, x, y);
      this._diamond(x, y1, x2, y);
      this._diamond(x, y, x2, y2);
      this._diamond(x1, y, x, y2);
    }
  }
}
