/* @flow */
import React, { Component, PropTypes } from 'react';
import DiamondSquare from '../utils/diamondSquare';
import Random from '../utils/random';
import olsenNoise from '../utils/olsenNoise';


const MAP_SIZE = 30;
const CELL_SIZE = 1;
const TILE_SIZE = 500;
const MAP_CELL_WIDTH = 50;
const MAP_CELL_HEIGHT = 50;
const random = new Random();

const MAP_SEED = 100; //random.integer(0, 10000);

export default class TileView extends Component {
  constructor() {
    super();
    this.state = {
      cx: null,
      cy: null,
      tx: 0,
      ty: 0
    };
  }
  componentDidMount() {
    this.init();
  }
  componentDidUpdate() {
    this.init();
  }
  init() {
    console.time('init');
    this.tiles = _.times(MAP_SIZE, () => _.times(MAP_SIZE, _.constant(null)));
    this.generateTile(this.state.tx, this.state.ty);
    this.draw();
    this.setupEvents();
    console.timeEnd('init');
  }
  draw() {
    const { cx, cy } = this.state;
    const canvas = this.refs.tile;
    canvas.width = this.heightmap.shape[0] * CELL_SIZE;
    canvas.height = this.heightmap.shape[0] * CELL_SIZE;
    const ctx = canvas.getContext('2d');


    // draw each pixel in the heightmap
    for (let hx = 0; hx < TILE_SIZE; hx++) {
      for (let hy = 0; hy < TILE_SIZE; hy++) {
        const height = Math.round(this.heightmap.get(hx, hy) / 5) * 5;
        if (height < 210) {
          ctx.fillStyle = `rgb(0, 0, 200)`;
        } else {
          ctx.fillStyle = `rgb(${height}, ${height}, ${height})`;
        }
        ctx.fillRect(
          hx * CELL_SIZE,
          hy * CELL_SIZE,
          CELL_SIZE, CELL_SIZE
        );
      }
    }

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
      console.log(`Clicked on cell (${cx}, ${cy}) (height: ${this.worldMap.get(cx, cy)})`);
      this.draw();
    });
  }
  generateTile(tx, ty) {
    console.time(`Making tile for (${tx}, ${ty})`);
    const canvas = this.refs.tile;
    const heightmap = olsenNoise(
      TILE_SIZE,
      TILE_SIZE,
      tx * TILE_SIZE,
      ty * TILE_SIZE,
      MAP_SEED
    );
    this.tiles[tx][ty] = heightmap;
    this.heightmap = heightmap;
    console.timeEnd(`Making tile for (${tx}, ${ty})`);
  }
  saveMap() {
    // save the map to local storage
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
            Location: ({this.state.tx}, {this.state.ty})
          </div>
          <button
            disabled={this.neighborExists('east')}
            onClick={this.goToNeighbor.bind(this, 'east')}>
            East
          </button>
          <button
            disabled={this.neighborExists('west')}
            onClick={this.goToNeighbor.bind(this, 'west')}>
            West
          </button>
          <button
            disabled={this.neighborExists('south')}
            onClick={this.goToNeighbor.bind(this, 'south')}>
            South
          </button>
          <button
            disabled={this.neighborExists('north')}
            onClick={this.goToNeighbor.bind(this, 'north')}>
            North
          </button>
        </div>
        <canvas ref="tile" />
        <div>
          <button onClick={() => this.saveMap()}>Save Map</button>
        </div>
      </div>
    )
  }
}
