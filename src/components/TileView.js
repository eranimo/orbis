/* @flow */
import React, { Component, PropTypes } from 'react';
import _ from 'lodash';
import DiamondSquare from '../utils/diamondSquare';
import Random from '../utils/random';
import olsenNoise from '../utils/olsenNoise';
import { Button } from '@blueprintjs/core';
import makeRivers from '../utils/flow';
import ds from 'datastructures-js';


const MAP_SIZE = 30;
const CELL_SIZE = 2;
const TILE_SIZE = 500;
const MAP_CELL_WIDTH = 50;
const MAP_CELL_HEIGHT = 50;
const random = new Random();
const SEA_LEVEL = 140;

const MAP_SEED = 6681; // random.integer(0, 10000);

class Cell {
  constructor(cx, cy, tile) {
    this.cx = cx;
    this.cy = cy;
    this.tile = tile;
    this.isRiver = false;
    this.isLake = false;
    this._neighbors = null;
  }

  get id() {
    return '(' + this.cx + ', ' + this.cy + ')';
  }

  get height() {
    return this.tile.heightmap.get(this.cx, this.cy);
  }

  get altitude() {
    return this.height - this.tile.world.sealevel;
  }

  get type() {
    return this.height < this.tile.world.sealevel ? 'ocean' : 'land';
  }

  get isLand() {
    return this.type === 'land';
  }

  get isOcean() {
    return this.type === 'ocean';
  }

  get isEdge() {
    return this.cx === 0 || this.cx === this.tile.width - 1 || this.cy === 0 || this.cy === this.height - 1;
  }


  // return neighboring tiles
  get neighbors() {
    if (this._neighbors !== null){
      return this._neighbors;
    }
    let n = [];
    if (this.cx !== this.tile.width - 1 && this.cy !== this.tile.height - 1) {
      n.push([this.cx + 1, this.cy + 1]);
    }
    if (this.cx !== 0 && this.cy !== 0) {
      n.push([this.cx - 1, this.cy - 1]);
    }
    if (this.cx !== 0 && this.cy !== this.tile.height - 1) {
      n.push([this.cx - 1, this.cy + 1]);
    }
    if (this.cx !== this.tile.width - 1 && this.cy !== 0) {
      n.push([this.cx + 1, this.cy - 1]);
    }
    if (this.cy !== this.tile.height - 1) {
      n.push([this.cx, this.cy + 1]);
    }
    if (this.cx !== this.tile.width - 1) {
      n.push([this.cx + 1, this.cy]);
    }
    if (this.cy !== 0) {
      n.push([this.cx, this.cy - 1]);
    }
    if (this.cx !== 0) {
      n.push([this.cx - 1, this.cy]);
    }
    n = n.map(([ x, y ]) => this.tile.getCell(x, y));
    this._neighbors = n;
    return this._neighbors;
  }

  get uphillCells() {
    return _.orderBy(_.filter(this.neighbors, ({ height }) => height > this.height), 'height', 'desc');
  }

  get downhillCells() {
    return _.orderBy(_.filter(this.neighbors, ({ height }) => height < this.height), 'height', 'asc');
  }

  get downhillLandCells() {
    return _.orderBy(_.filter(this.neighbors, ({ height, isRiver, isLake }) => height < this.height && !isRiver && !isLake), 'height', 'asc');
  }

  get levelledCells() {
    return _.filter(this.neighbors, ({ height }) => height === this.height)
  }

  get isCoastal() {
    return this.isLand && _.some(this.neighbors, ['isOcean', true]);
  }

  get isValidRiverSource() {
    return this.downhillLandCells.length > 0;
  }

  flood(conditionFunc) {
    return this.tile.floodFillAt(this.cx, this.cy, conditionFunc);
  }

  toString() {
    return `Cell(cx: ${this.cx}, cy: ${this.cy}, height: ${this.height}, type: ${this.type})`;
  }
}


class Tile {
  constructor(tx, ty, world) {
    this.tx = tx;
    this.ty = ty;

    this.world = world;

    this.heightmap = olsenNoise(
      TILE_SIZE,
      TILE_SIZE,
      tx * TILE_SIZE,
      ty * TILE_SIZE,
      MAP_SEED
    );

    this.width = this.heightmap.shape[0];
    this.height = this.heightmap.shape[1];

    this.cells = _.times(this.width, () => _.times(this.height, _.constant(null)));
  }

  getCell(x, y) {
    if (this.cells[x][y] === null) {
      this.cells[x][y] = new Cell(x, y, this);
    }
    return this.cells[x][y];
  }

  forEachCell(func) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        func(this.getCell(x, y));
      }
    }
  }

  getCoastalCells() {
    const coastal = [];
    this.forEachCell(cell => {
      if (cell.isCoastal) {
        coastal.push(cell);
      }
    });
    return coastal;
  }

  // perform a flood fill at a point
  // returning a list of cells that match it
  floodFillAt(x, y, conditionFunc) {
    const visited = new Set();
    const queue = new ds.queue();

    queue.enqueue(this.getCell(x, y));

    while (!queue.isEmpty()) {
      const cell = queue.dequeue();

      if (conditionFunc(cell) && !visited.has(cell)) {
        visited.add(cell);
        cell.neighbors.forEach(queue.enqueue);
      }
    }
    return visited;
  }

}


class WorldMap {
  constructor(width, height, sealevel) {
    this.width = width;
    this.height = height;
    this.sealevel = sealevel;
    this.tiles = _.times(width, () => _.times(height, _.constant(null)));
  }

  generateTile(tx, ty) {
    if (this.tiles[tx][ty] === null) {
      this.tiles[tx][ty] = new Tile(tx, ty, this);
    }
    return this.tiles[tx][ty];
  }

  getTile(tx, ty) {
    return this.tiles[tx][ty];
  }
}



export default class TileView extends Component {
  constructor() {
    super();
    this.state = {
      cx: null,
      cy: null,
      tx: 1,
      ty: 1
    };
  }
  componentDidMount() {
    this.worldMap = new WorldMap(MAP_CELL_WIDTH, MAP_CELL_HEIGHT, SEA_LEVEL);
    this.init();
  }
  componentDidUpdate() {
    this.init();
  }
  init() {
    console.group(`Initialize tile ${this.state.tx}, ${this.state.ty}`);

    console.time('Generate or get tile');
    this.worldMap.generateTile(this.state.tx, this.state.ty);
    console.timeEnd('Generate or get tile');

    this.rivers = [];

    console.time('Draw tile');
    this.draw();
    console.timeEnd('Draw tile');

    this.setupEvents();
    console.groupEnd(`Initialize tile ${this.state.tx}, ${this.state.ty}`);
  }
  draw() {
    const { cx, cy } = this.state;
    const canvas = this.refs.tile;
    canvas.width = this.currentTile.heightmap.shape[0] * CELL_SIZE;
    canvas.height = this.currentTile.heightmap.shape[0] * CELL_SIZE;
    const ctx = canvas.getContext('2d');


    // draw each pixel in the currentTile.heightmap
    for (let hx = 0; hx < TILE_SIZE; hx++) {
      for (let hy = 0; hy < TILE_SIZE; hy++) {
        const cell = this.currentTile.getCell(hx, hy);
        const height = Math.round(this.currentTile.heightmap.get(hx, hy) / 3) * 3;
        if (this.currentTile.heightmap.get(hx, hy) < this.worldMap.sealevel) {
          ctx.fillStyle = 'rgb(0, 0, 200)';
        } else {
          ctx.fillStyle = `rgb(${height}, ${height}, ${height})`;
        }

        // if (!cell.isEdge && cell.downhillCells.length === 0) {
        //   ctx.fillStyle = 'purple';
        // } else if (this.lake.cell === cell) {
        //   ctx.fillStyle = 'red';
        // } else if(this.lake.spill === cell) {
        //   ctx.fillStyle = 'yellow';
        // } else if (this.lake.lake.has(cell)) {
        //   ctx.fillStyle = 'green';
        // }

        ctx.fillRect(
          hx * CELL_SIZE,
          hy * CELL_SIZE,
          CELL_SIZE, CELL_SIZE
        );
      }
    }

    console.groupCollapsed('Draw rivers');
    function drawRiverPart(part) {
      console.log('drawing', part);
      if (part.cells) {
        ctx.fillStyle = `rgba(0, ${_.random(0, 255)}, ${_.random(0, 255)}, 0.2)`;
        part.cells.forEach(cell => {
          ctx.fillRect(cell.cx * CELL_SIZE, cell.cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        });
      } else {
        ctx.fillStyle = 'blue';
        ctx.fillRect(part.cell.cx * CELL_SIZE, part.cell.cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    this.rivers.forEach(river => {
      let active = river.next;
      while(active !== null) {
        drawRiverPart(active);
        active = active.next;
      }
    });
    console.groupEnd('Draw rivers');


    // if (cx !== null && cy !== null) {
    //   ctx.strokeStyle = `black`;
    //   ctx.strokeWidth = 1;
    //   ctx.rect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    //   ctx.stroke();
    // }
  }
  pointToCell(event) {
    let { pageX: mx, pageY: my } = event;
    mx = mx - event.currentTarget.offsetLeft;
    my = my - event.currentTarget.offsetTop;
    const cx = Math.floor(mx / CELL_SIZE);
    const cy = Math.floor(my / CELL_SIZE);
    return { cx, cy };
  }
  setupEvents() {
    const canvas = this.refs.tile;
    // canvas.addEventListener('mousemove', event => {
    //   const { cx, cy } = this.pointToCell(event);
    //   this.setState({ cx, cy });
    // });

    canvas.addEventListener('click', event => {
      const { cx, cy } = this.pointToCell(event);
      console.log(`Clicked on cell (${cx}, ${cy}) (height: ${this.currentTile.heightmap.get(cx, cy)})`);

      const clickedCell = this.currentTile.getCell(cx, cy);
      console.log(clickedCell, clickedCell.downhillLandCells);

      if (clickedCell.isValidRiverSource) {
        console.time('Make rivers');
        const rivers = makeRivers(this.currentTile, clickedCell);
        console.log(rivers);
        this.rivers = rivers;
        console.timeEnd('Make rivers');
        this.draw();
      }


      // this.draw();
    });
  }
  get currentTile() {
    return this.worldMap.tiles[this.state.tx][this.state.ty];
  }
  neighborExists(direction) {
    const { tx, ty } = this.state;
    if (direction === 'east') {
      return tx === MAP_CELL_WIDTH;
    } else if (direction === 'west') {
      return tx === 0;
    } else if (direction === 'south') {
      return ty === MAP_CELL_HEIGHT;
    } else if (direction === 'north') {
      return ty === 0;
    }
  }
  goToNeighbor(direction) {
    const { tx, ty } = this.state;
    if (direction === 'east') {
      this.setState({
        tx: tx + 1,
        ty
      });
    } else if (direction === 'west') {
      this.setState({
        tx: tx - 1,
        ty
      });
    } else if (direction === 'south') {
      this.setState({
        tx,
        ty: ty + 1
      });
    } else if (direction === 'north') {
      this.setState({
        tx,
        ty: ty - 1
      });
    }
  }
  render() {
    return (
      <div>
        <h1>
          World Map Generator
        </h1>
        <h2>Step 1</h2>
        <p>
          Click on a tile to generate its detailed heightmap
        </p>
        <div>
          <div>
            Location: ({this.state.tx}, {this.state.ty})<br />
            Seed: {MAP_SEED}
          </div>
          <div className="pt-button-group">
            <Button
              disabled={this.neighborExists('west')}
              onClick={this.goToNeighbor.bind(this, 'west')}
              iconName="pt-icon-double-chevron-left"
              text="West" />
            <Button
              disabled={this.neighborExists('south')}
              onClick={this.goToNeighbor.bind(this, 'south')}
              iconName="pt-icon-double-chevron-down"
              text="South" />
            <Button
              disabled={this.neighborExists('north')}
              onClick={this.goToNeighbor.bind(this, 'north')}
              iconName="pt-icon-double-chevron-up"
              text="North" />
            <Button
              disabled={this.neighborExists('east')}
              onClick={this.goToNeighbor.bind(this, 'east')}
              iconName="pt-icon-double-chevron-right"
              text="East" />
          </div>
        </div>
        <br />
        <canvas ref="tile" />
      </div>
    )
  }
}
