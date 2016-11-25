import nj from 'numjs';
import _ from 'lodash';

export default class Flow {
  constructor(heightmap, sealevel) {
    this.heightmap = heightmap;
    this.sealevel = sealevel;

    this.width = heightmap.shape[0];
    this.height = heightmap.shape[1];

    // stores the amount of water at each cell
    this.watermap = nj.ones([this.width, this.height]);

    // stores the amount of water that has passed through each cell
    this.flowmap = nj.zeros([this.width, this.height]);

    const coordinateHash = (x, y) => `${x}-${y}`;
    this.neighbors = _.memoize(this._neighbors, coordinateHash);
    this.getWaterHeight = _.memoize(this._getWaterHeight, coordinateHash);
    this.getFlowNeighbors = _.memoize(this._getFlowNeighbors, coordinateHash);


    this.flowmapMean = null;
  }

  // gets the neighbors without wrapping
  // returns a tuple of x, y coordinates
  _neighbors(x, y) {
    const n = [];
    if (x !== this.width - 1 && y !== this.height - 1) {
      n.push([x + 1, y + 1]);
    }
    if (x !== 0 && y !== 0) {
      n.push([x - 1, y - 1]);
    }
    if (x !== 0 && y !== this.height - 1) {
      n.push([x - 1, y + 1]);
    }
    if (x !== this.width - 1 && y !== 0) {
      n.push([x + 1, y - 1]);
    }
    if (y !== this.height - 1) {
      n.push([x, y + 1]);
    }
    if (x !== this.width - 1) {
      n.push([x + 1, y]);
    }
    if (y !== 0) {
      n.push([x, y - 1]);
    }
    if (x !== 0) {
      n.push([x - 1, y]);
    }
    return n;
  }

  _getWaterHeight(x, y) {
    return this.heightmap.get(x, y) + this.watermap.get(x, y);
  }

  _getFlowNeighbors(x, y) {
    const myWaterHeight = this.getWaterHeight(x, y);
    const neighbors = this.neighbors(x, y)
      .map(([ x, y ]) => {
        return {
          height: this.heightmap.get(x, y),
          waterHeight: this.getWaterHeight(x, y),
          x, y
        };
      });
    const sorted = _.sortBy(neighbors, 'height', 'desc');
    // only get the neighbors that have a lower water height
    const filtered = _.filter(sorted, ({ waterHeight, height }) => waterHeight < myWaterHeight && height > this.sealevel);
    return filtered;
  }

  get waterHeightGrid() {
    return this.heightmap.add(this.watermap);
  }

  get averageWaterHeight() {
    return this.waterHeightGrid.mean();
  }

  /* River flow algorithm
   *
   * Move all water downhill:
   *
   * definitions:
   *  - height: the value of the heightmap (terrain height)
   *  - watermap amount: the value of the watermap (water amount)
   *  - water height: the sum of the height and the water amount
   *
   * if there is a neighboring cell that has a water height below this cell, (<=),
   *  transfer this cell's water amount to that cell
   * if the lowest neighbor's water height is equal to this cell's water height, (=)
   *  then form a lake by not moving the water
   * if there are no neighboring cells with a lower water height, (>)
   *  then form a lake by not moving the water
   */
  step() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const myHeight = this.heightmap.get(x, y);
        if (myHeight > this.sealevel) {
          const myWaterAmount = this.watermap.get(x, y);
          const flowNeighbors = this.getFlowNeighbors(x, y);
          if (flowNeighbors && flowNeighbors.length > 0) {
            const lowest = flowNeighbors[0];
            this.watermap.set(x, y, 0);
            const flow = this.watermap.get(lowest.x, lowest.y) + myWaterAmount;
            this.watermap.set(lowest.x, lowest.y, flow);
            this.flowmap.set(x, y, this.flowmap.get(x, y) + flow);
          }
        }
      }
    }

    this.flowmapMean = this.flowmap.mean();
    this.flowmapMax = this.flowmap.max();
    console.log(`Min: ${this.flowmap.min()}, Max: ${this.flowmap.max()}, Mean: ${this.flowmap.mean()}`);
  }
}
