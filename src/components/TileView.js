/* @flow */
import React, { Component, PropTypes } from 'react';
import DiamondSquare from '../utils/diamondSquare';
import Random from '../utils/random';
import olsenNoise from '../utils/olsenNoise';


const MAP_SIZE = 30;
const CELL_SIZE = 50;
const random = new Random();

export default class TileView extends Component {
  constructor() {
    super();
    this.state = {
      cx: null,
      cy: null
    };
  }
  componentDidMount() {
    this.remake();
  }
  componentDidUpdate() {
    this.draw();
  }
  remake() {
    console.time('generate');
    this.tiles = _.times(MAP_SIZE, () => _.times(MAP_SIZE, _.constant(null)));
    this.generate();
    this.draw();
    this.setupEvents();
    console.timeEnd('generate');
  }
  generate() {
    this.random = random;
    const heightmap = new DiamondSquare({
      size: MAP_SIZE,
      wrap: true,
      roughness: 40
    }, random);
    heightmap.generate();
    console.log(`Average height: ${heightmap.avgHeight}`);
    this.worldMap = heightmap;
  }
  decidePixelColor(x, y, heightmap, sealevel = heightmap.avgHeight) {
    const height = parseInt(heightmap.get(x, y), 10);
    return height < sealevel
      ? `rgb(0, 0, ${200 - parseInt(heightmap.minHeight - height, 10) * 5})`
      : `rgb(0, ${200 + parseInt(height - heightmap.avgHeight, 10) * 5}, 0)`;
  }
  draw() {
    const { cx, cy } = this.state;
    const canvas = this.refs.tile;
    canvas.width = this.worldMap.size * CELL_SIZE;
    canvas.height = this.worldMap.size * CELL_SIZE;
    const ctx = canvas.getContext('2d');

    for (let x = 0; x < this.worldMap.size; x++) {
      for (let y = 0; y < this.worldMap.size; y++) {
        ctx.fillStyle = this.decidePixelColor(x, y, this.worldMap);
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    for (let tx = 0; tx < this.worldMap.size; tx++) {
      for (let ty = 0; ty < this.worldMap.size; ty++) {
        const heightmap = this.tiles[tx][ty];
        if (heightmap) {

          // draw each pixel in the heightmap
          for (let hx = 0; hx < CELL_SIZE; hx++) {
            for (let hy = 0; hy < CELL_SIZE; hy++) {
              const height = Math.round(heightmap.get(hx * 10, hy * 10) / 10) * 10;
              if (height < 100) {
                ctx.fillStyle = `rgb(0, 0, 200)`;
              } else {
                ctx.fillStyle = `rgb(${height}, ${height}, ${height})`;
              }
              ctx.fillRect(
                (tx * CELL_SIZE) + hx,
                (ty * CELL_SIZE) + hy,
                1, 1
              );
            }
          }
        }
      }
    }

    if (cx !== null && cy !== null) {
      ctx.strokeStyle = `black`;
      ctx.strokeWidth = 1;
      ctx.rect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.stroke();
    }
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
    canvas.addEventListener('mousemove', event => {
      const { cx, cy } = this.pointToCell(event);
      this.setState({ cx, cy });
    });

    canvas.addEventListener('click', event => {
      const { cx, cy } = this.pointToCell(event);
      console.log(`Clicked on cell (${cx}, ${cy}) (height: ${this.worldMap.get(cx, cy)})`);
      this.generateTile(cx, cy);
      this.draw();
    });
  }
  generateTile(tx, ty) {
    console.time(`Making tile for (${tx}, ${ty})`);
    const canvas = this.refs.tile;
    const heightmap = olsenNoise(
      500,
      500,
      tx * 500,
      ty * 500
    );
    this.tiles[tx][ty] = heightmap;
    window.heightmap = heightmap;
    console.timeEnd(`Making tile for (${tx}, ${ty})`);
  }
  saveMap() {
    // save the map to local storage
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
          <h3>Controls:</h3>
          <button onClick={() => this.remake()}>New Map</button>
        </div>
        <canvas ref="tile" />
        <div>
          <button onClick={() => this.saveMap()}>Save Map</button>
        </div>
      </div>
    )
  }
}
