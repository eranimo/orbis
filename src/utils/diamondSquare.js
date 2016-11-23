import nj from 'numjs';
import _ from 'lodash';
import Random from 'random-js';
import ds from 'datastructures-js';
import nextafter from 'nextafter';

export default class DiamondSquare {

  constructor(options, random) {
    // prepare the grid
    this.size = options.size || 256;
    this.roughness = options.roughness || 1;
    this.random = random;
    this.cornerPoints = options.cornerPoints;
    this.wrap = options.wrap;
    this.range = options.range || { low: 0, high: 255 };
    this.mutate = options.mutate;
    this.sideGetters = options.sideGetters;
    this.flip = options.flip || false;
  }

  get(x, y) {
    return this.grid.get(x, y);
  }

  set(x, y, val) {
    this.grid.set(x, y, val);
  }

  generate() {
    this.grid = nj.zeros([this.size, this.size], 'float32');
    if (this.cornerPoints) {
      this.grid.set(0, 0, this.cornerPoints.topLeft);
      this.grid.set(this.size - 1, 0, this.cornerPoints.topRight);
      this.grid.set(0, this.size - 1, this.cornerPoints.bottomLeft);
      this.grid.set(this.size - 1, this.size - 1, this.cornerPoints.bottomRight);
    } else {
      const { low, high } = this.range;
      const top = this.random.integer(low, high);
      const bottom = this.random.integer(low, high);

      this.grid.set(0, 0, top);
      this.grid.set(this.size - 1, 0, top);
      this.grid.set(0, this.size - 1, bottom);
      this.grid.set(this.size - 1, this.size - 1, bottom);
    }

    this._diamond(0, 0, this.size - 1, this.size - 1);

    // simple erosion
    for (let x = 1; x < this.size - 1; x++) {
      for (let y = 1; y < this.size - 1; y++) {
        this.grid.set(x, y, _.mean([
          this.grid.get(x + 1, y + 1),
          this.grid.get(x - 1, y - 1),
          this.grid.get(x - 1, y + 1),
          this.grid.get(x + 1, y - 1),
          this.grid.get(x, y + 1),
          this.grid.get(x + 1, y),
          this.grid.get(x, y - 1),
          this.grid.get(x - 1, y)
        ]));
      }
    }

    if (this.flip) {
      this.grid = this.grid.T;
    }

    if (this.mutate) {
      for (let x = 0; x < this.size; x++) {
        for (let y = 0; y < this.size; y++) {
          const height = this.grid.get(x, y);
          this.grid.set(x, y, this.mutate(height, x, y));
        }
      }
    }

    this.maxHeight = _.round(this.grid.max());
    this.minHeight = _.round(this.grid.min());
    this.avgHeight = _.round(this.grid.mean());

    // console.time('depression fill');
    // this.fillDepressions();
    // console.timeEnd('depression fill');
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
      let value = (this.grid.get(xa, ya) + this.grid.get(xb, yb)) / 2;
      value += this.random.real(-0.5, 0.5) * d * this.roughness;
      // Wrap around map:
      if (this.wrap) {
        if (y === 0) {
          this.grid.set(x, this.size - 1, value);
        }
        if ((x === 0 || x === this.size - 1) && y < this.size - 1) {
          this.grid.set(x, this.size - 1 - y, value);
        }
      } else if (this.sideGetters){
        if (y === 0) {
          value = this.sideGetters.west(x, y, value);
        } else if (y === this.size - 1) {
          value = this.sideGetters.east(x, y, value);
        } else if (x === 0) {
          value = this.sideGetters.north(x, y, value);
        } else if (x === this.size - 1) {
          value = this.sideGetters.south(x, y, value);
        }
      }
      this.grid.set(x, y, _.clamp(value, this.range.low, this.range.high));
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
