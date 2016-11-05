/* @flow */
import React, { Component } from 'react';
import poissonDiscSampler from '../utils/poissonDisk';
import Voronoi from 'voronoi';
import _ from 'lodash';
import DiamondSquare from '../utils/diamondSquare.js';
import { curve } from 'cardinal-spline-js/curve_func.js';
import Point from './point';
import { drawDot, drawEdge, drawArrow, drawTriangle } from './draw';


function getDots(sampler) {
	const dots = [];
  while(true) {
	  const dot = sampler()
  	if (dot) {
	    dots.push({x: dot[0], y: dot[1]});
    } else {
    	return dots;
    }
  }
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function renderMap(canvas, settings = {}) {
  settings = Object.assign({}, {
    width: 500,
    heigth: 500,
    drawElevationArrows: false,
    drawTriangles: true,
    drawCells: true,
    drawEdges: true,
    drawNeighborNetwork: true,
    drawInnerEdges: true,
    drawCenterDot: true,
    drawHeightMarkers: false,
    radius: 10,
    cellInitialWater: 5,
    riverThreshold: 50
  }, settings);
  const ctx = canvas.getContext('2d');

  canvas.width = settings.width;
  canvas.height = settings.height;

  // get Poisson-Disc dots
  const sampler = poissonDiscSampler(settings.width, settings.height, settings.radius);
  const dots = getDots(sampler);

  const voronoi = new Voronoi();
  const bbox = {
  	xl: 0,
    xr: settings.width,
    yt: 0,
    yb: settings.height
  };
  // compute voronoi diagram
  console.time('voronoi computing');
  voronoi.quantizeSites(dots);
  const diagram = voronoi.compute(dots, bbox);
  diagram.edges = diagram.edges.map(edge => {
    edge.id = guid();
    return edge;
  });
  console.timeEnd('voronoi computing');

  console.log(diagram);

  console.time('diamond square');
  // console.profile('diamond square');
  const HEIGHTMAP_SIZE = 256;
  const smallerHeightmap = new DiamondSquare({
    size: HEIGHTMAP_SIZE
  });
  smallerHeightmap.generate();
  // console.profileEnd('diamond square');
  console.timeEnd('diamond square');

  const seaLevelHeight = smallerHeightmap.grid.mean()
  const minHeight = smallerHeightmap.grid.min()
  const maxHeight = smallerHeightmap.grid.max()

  const getHeightAtPoint = _.memoize(function getHeightAtPoint(point) {
    return smallerHeightmap.get(
      Math.floor(point.x / (settings.width / HEIGHTMAP_SIZE * 2)),
      Math.floor(point.y / (settings.height / HEIGHTMAP_SIZE * 2))
    );
  });

  const contours = {
    [seaLevelHeight - 20]: [30, 22, 75],
    [seaLevelHeight - 20]: [38, 30, 75],
    [seaLevelHeight - 10]: [44, 44, 87],
    [seaLevelHeight]: [54, 54, 97],
    [seaLevelHeight + 20]: [114, 156, 101],
    [seaLevelHeight + 30]: [124, 160, 111],
    [seaLevelHeight + 40]: [133, 169, 121],
    [seaLevelHeight + 55]: [169, 185, 150],
    [seaLevelHeight + 65]:[199, 216, 194],
    [Infinity]: [211, 222, 210]
  };

  const getColorForHeight = _.memoize(function getColorForHeight(h) {
    for (const height of Object.keys(contours)) {
      if (h < height) {
        return contours[height];
      }
    }
  });

  const getColorAtPoint = _.memoize(function getColorAtPoint(point) {
    return getColorForHeight(getHeightAtPoint(point));
  });

  function colorEdge() {
    return [51, 102, 153]; // river
  }

  function randomizeColor(color, range=1) {
    return [
      _.clamp(color[0] + _.random(-range, range), 0, 255),
      _.clamp(color[1] + _.random(-range, range), 0, 255),
      _.clamp(color[2] + _.random(-range, range), 0, 255)
    ]
  }

  function colorToRGB (color) {
    return `rgb(${color.map(c => c.toString()).join(', ')})`;
  }

  function drawCellTriangle(ctx, p_from, p_cell, p_to, center) {
    const color = colorToRGB(getColorAtPoint(center));
    drawTriangle(ctx, p_from, p_cell, p_to, color);
  }

  // draw cell centers in red
  if (settings.drawCenterDot) {
    diagram.cells.forEach(cell => {
  		drawDot(ctx, new Point(cell.site.x, cell.site.y), 'red');
    });
  }


  let cells = []; // index matches voronoiId

  class Side {
    constructor(edge, sides) {
      this.edge = edge;
      this.id = edge.id;
      this.water = 1;

      this.from = new Point(edge.va.x, edge.va.y);
      this.to = new Point(edge.vb.x, edge.vb.y);

      this.left = cells[edge.lSite.voronoiId];
      this.left.sides.add(this);
      if (edge.rSite) {
        this.right = cells[edge.rSite.voronoiId];
        this.right.sides.add(this);
      }

      if (this.left && this.right) {
        this.water = this.right.water + this.left.water / 2;
        this.height = this.right.height + this.left.height / 2;
      }

      this.center = this.from.between(this.to);
    }

    nextToSide(side) {
      return this.from.isEqual(side.from) ||
        this.to.isEqual(side.to) ||
        this.from.isEqual(side.to) ||
        this.to.isEqual(side.from)
    }

    toString() {
      return `Side(from: ${this.from} to: ${this.to})`;
    }
  }

  class Cell {
    constructor(cell, voronoiId, center, height, type) {
      this.voronoiId = voronoiId;
      this.center = center;
      this.type = type;
      this.height = height;
      this.distanceFromCoast = 0;
      this.voronoiCell = cell;
      this.coastal = false;
      this.water = type === 'land' ? settings.cellInitialWater : 0;
      this.flow = type === 'land' ? settings.cellInitialWater : 0;
      this.sides = new Set();
      //neighbors
    }

    equalTo(cell) {
      return this.voronoiId === cell.voronoiId;
    }

    // returns the side between this cell and another, null if no side shared with given cell
    sideWith(cell) {
      for (const side of this.sides) {
        if (side.left && side.right &&
            side.left.equalTo(this) && side.right.equalTo(cell) ||
            side.right.equalTo(this) && side.left.equalTo(cell)) {
          return side;
        }
      }
      return null;
    }
  }
  // make Cell instances
  diagram.cells.forEach((cell, index) => {
    const center = new Point(cell.site.x, cell.site.y);
    const height = getHeightAtPoint(center);
    const type = height < seaLevelHeight ? 'ocean' : 'land';
    cells.push(new Cell(cell, index, center, height, type));
  });

  cells = cells.map(cell => {
    cell.neighbors = cell.voronoiCell.getNeighborIds().map(index => cells[index]);
    if (cell.type === 'land' && cell.neighbors.filter(c => c.type === 'ocean').length > 0) {
      cell.coastal = true;
    }
    return cell;
  });

  // associate Edges with Cells
  let sides = [];

  diagram.edges.forEach(edge => {
    const side = new Side(edge, sides);
    sides.push(side);
  });

  function computeDistanceFromCoast() {
    let coastal = new Set(cells.filter(c => c.coastal));
    let visited = {};
    coastal.forEach(c => {
      c.distanceFromCoast = 1;
      visited[c.voronoiId] = true;
    })
    let activeCellsSet = new Set(_.flatten(Array.from(coastal).map(c => c.neighbors).filter(c => !visited[c.voronoiId])));
    let distance = 0;
    while(activeCellsSet.size > 0) {
      distance += 1;
      let neighborsSet = new Set();
      activeCellsSet.forEach(cell => {
        if (cell.type === 'ocean') return;
        visited[cell.voronoiId] = true;
        cell.distanceFromCoast = distance;
        cell.neighbors.forEach(n => {
          if (n.type === 'land' && !visited[n.voronoiId]) {
            neighborsSet.add(n);
          }
        });
      });
      activeCellsSet.clear();
      activeCellsSet = neighborsSet;
    }
  }
  computeDistanceFromCoast();

  cells = cells.map(cell => {
    if (cell.type === 'land') {
      cell.height = seaLevelHeight + (cell.distanceFromCoast * 7 + _.random(1.0, 3.9));
    }
    return cell;
  });

  // river flow
  while(_.sumBy(cells, 'flow') > 0) {
    cells.forEach(cell => {
      const found = _.sortBy(cell.neighbors, 'height')[0];
      if (found.type === 'land') {
        found.water += cell.water;
        found.flow += cell.flow;
      }
      cell.downstream = found;
      cell.flow = 0;
    });
  }

  let rivers = [];

  class RiverSegment {
    constructor(cell) {
      this.cell = cell;
      if (this.riverSegment) {
        throw new Error(`${cell} already has a river segment`);
      } else {
        cell.isRiver = true;
        cell.riverSegment = this;
      }
      this.upstream = new Set();
      this.sortedUpstream = [];
    }

    addUpstream(segment) {
      this.upstream.add(segment);
      this.sortedUpstream = _.orderBy(Array.from(this.upstream), seg => seg.cell.water).reverse();
    }

    get trunk() {
      return _.head(this.sortedUpstream);
    }

    get branches() {
      return _.tail(this.sortedUpstream);
    }
  }

  function riverStep(cell, isRoot = false) {
    const segment = new RiverSegment(cell);
    const neighbors = cell.neighbors
      .filter(c => c.height > cell.height &&
                   c.type === 'land' &&
                   c.water > settings.riverThreshold &&
                   c.water < cell.water);
    if (!isRoot && cell.coastal) return segment;
    _.uniq(neighbors).forEach(n => {
      if (!n.isRiver) {
        const nsegment = riverStep(n);
        segment.addUpstream(nsegment);
      }
    });
    return segment;
  }

  cells.forEach(cell => {
    if (cell.coastal && cell.water > settings.riverThreshold && !cell.isRiver) {
      const seg = riverStep(cell, true);
      rivers.push(seg);
    }
  });

  console.log('cells', cells);
  console.log('sides', sides);
  console.log('rivers', rivers);

  // drawing
  if (settings.drawCells) {
    cells.forEach(cell => {
      const color = getColorForHeight(cell.height);
      ctx.fillStyle = colorToRGB(randomizeColor(color));
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.lineWidth = 1;
      const start = cell.voronoiCell.halfedges[0].getStartpoint();
      ctx.moveTo(start.x, start.y);
      cell.voronoiCell.halfedges.forEach((halfEdge, index) => {
        const end = halfEdge.getEndpoint();
        ctx.lineTo(end.x, end.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }



  if (settings.drawElevationArrows) {
    sides.forEach(side => {
      if (getHeightAtPoint(side.center) >= seaLevelHeight) {
        drawArrow(
          ctx,
          side.up.point,
          side.center,
          3
        );
      }
    });
  }

  // draw triangles, both on each side of each edge
  if (settings.drawTriangles) {
    edges.forEach(edge => {
      const center = new Point(
        (edge.from.point.x + edge.to.point.x + edge.edge.lSite.x) / 3,
        (edge.from.point.y + edge.to.point.y + edge.edge.lSite.y) / 3
      );
      // left side
      if (edge.edge.lSite) {
        drawCellTriangle(
          ctx,
          edge.from.point,
          edge.edge.lSite,
          edge.to.point,
          center
        );
      }

      // right side
      if (edge.edge.rSite) {
        drawCellTriangle(
          ctx,
          edge.from.point,
          edge.edge.rSite,
          edge.to.point,
          center
        );
      }
    });
  }


  // draw lines to neighbors
  if (settings.drawNeighborNetwork) {
    diagram.cells.forEach(cell => {
      const neighbors = cell.getNeighborIds();
      neighbors.forEach(index => {
        const neighbor = diagram.cells[index];
        drawEdge(
          ctx,
          new Point(cell.site.x, cell.site.y),
          new Point(neighbor.site.x, neighbor.site.y),
          1,
          '#C0C0C0'
        );
      });
    });
  }

  // draw voronoi edges
  if (settings.drawEdges) {
    sides.forEach(side => {
    	drawEdge(
      	ctx,
      	side.to,
        side.from,
        1,
        '#111'
      );
    });
  }

  if (settings.drawHeightMarkers) {
    cells.forEach(cell => {
      if (cell.height >= seaLevelHeight) {
        ctx.font = '8px Fira Code';
        ctx.fillStyle = 'white';
        ctx.textAlign = "center";
        ctx.fillText(
          _.round(cell.height - seaLevelHeight, 1),
          cell.center.x,
          cell.center.y + 5
        );
      }
    });
  }

  if (settings.drawDistanceFromCoast) {
    cells.forEach(cell => {
      // draw distanceFromCoast number
      ctx.font = '8px Fira Code';
      ctx.fillStyle = 'white';
      ctx.textAlign = "center";
      ctx.fillText(
        _.round(cell.distanceFromCoast, 1) || '',
        cell.center.x,
        cell.center.y + 5
      );
    });
  }

  const drawnSegments = new Set();

  const avgWater = _.meanBy(cells, 'water');
  function decideRiverWidth(cell) {
    if (cell.water > avgWater) return 2;
    return 1;
  }

  if (settings.drawRivers) {
    rivers.forEach(segment => {
      const nearestOcean = _.sortBy(segment.cell.neighbors.filter(c => c.type === 'ocean'), c => c.center.distanceTo(segment.cell.center), 'ASC')[0];
      const mouth = nearestOcean.sideWith(segment.cell);
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 255, 1)';
      ctx.lineWidth = segment.upstream.length === 0 ? 1 : 2;
      ctx.moveTo(mouth.center.x, mouth.center.y);
      ctx.lineTo(segment.cell.center.x, segment.cell.center.y);
      ctx.stroke();
      ctx.closePath();

      function drawSegment(lastSeg, seg) {
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0, 0, 255, 1)';
        ctx.moveTo(lastSeg.cell.center.x, lastSeg.cell.center.y);
        const between = lastSeg.cell.sideWith(seg.cell);
        ctx.strokeWidth = decideRiverWidth(seg.cell);
        curve(ctx, [
          lastSeg.cell.center.x, lastSeg.cell.center.y,
          between.center.x, between.center.y,
          seg.cell.center.x, seg.cell.center.y
        ], 0.2, 100);
        ctx.stroke();
        ctx.closePath();
        seg.upstream.forEach(s => drawSegment(seg, s));
      }
      segment.upstream.forEach(seg => {
        drawSegment(segment, seg);
      });
    });
  }

  if (settings.drawCellWaterAmount) {
    cells.forEach(cell => {
      if (cell.water > 1000) {
        drawDot(ctx, cell.center, 'rbga(0, 255, 0, 0.75)', 7);
      }

      // draw distanceFromCoast number
      ctx.font = '10px Fira Code';
      ctx.fillStyle = 'white';
      ctx.textAlign = "center";
      ctx.fillText(
        cell.water,
        cell.center.x,
        cell.center.y + 5
      );
    });
  }

  if (settings.drawSideSlopeArrows) {
    sides.forEach(side => {
      // draw an arrow from each edge center to its downstream edge center
      if (side.down) {
        drawArrow(ctx, side.center, side.down.center, 5, 'rgba(255, 0, 0, 0.75)');
        drawEdge(ctx, side.center, side.down.center, 2,  'rgba(255, 0, 0, 0.75)');
      }
    });
  }


  if (settings.drawEdgeHeight) {
    sides.filter(c => c.crest).forEach(side => {
      drawDot(ctx, side.center, 'purple', 3);
    });
    ctx.font = '7px Fira Code';
    ctx.fillStyle = 'black';
    ctx.textAlign = "center";
    sides.forEach(side => {
      ctx.fillText(
        _.round(side.height, 1) || '',
        side.center.x,
        side.center.y + 10
      );
    })
    ctx.fillStyle = 'white';
    sides.forEach(side => {
      ctx.fillText(
        _.round(side.height, 1) || '',
        side.center.x + 1,
        side.center.y + 11
      );
    })
  }

  if (settings.drawEdgeWaterHeight) {
    ctx.font = '7px Fira Code';
    ctx.fillStyle = 'white';
    ctx.textAlign = "center";
    sides.forEach(side => {
      ctx.fillText(
        _.round(side.water, 1) || '',
        side.center.x,
        side.center.y + 5
      );
    })
  }

}


class WorldMap extends Component {
  componentDidMount() {
    this.draw();
  }
  redraw() {
    this.draw();
  }
  draw() {
    console.group('Map draw');
    console.time('total draw');
    renderMap(this.refs.board, {
      width: 1500,
      height: 700,
      radius: 20,

      drawSideSlopeArrows: false,
      drawEdgeHeight: false,

      drawRivers: true,
      drawCells: true,
      drawTriangles: false,
      drawEdges: true,
      drawCellWaterAmount: false,
      drawHeightMarkers: false,
      drawElevationArrows: false,
      drawNeighborNetwork: false,
      drawInnerEdges: false,
      drawCenterDot: false
    });
    console.timeEnd('total draw');
    console.groupEnd();
  }
  render() {
    return (
      <div>
        <div>
          <h2>Controls</h2>
          <button onClick={this.redraw.bind(this)}>Redraw</button>
        </div>
        <canvas ref="board"></canvas>
      </div>
    )
  }
}

export default WorldMap;
