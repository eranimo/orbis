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
    cellInitialWater: 2,
    riverThreshold: 100
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
  console.log(smallerHeightmap);
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

      this.from = new Point(edge.va.x, edge.va.y).round();
      this.to = new Point(edge.vb.x, edge.vb.y).round();

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

      this.connectedSides = new Set();
      const searchRadius = 10; // settings.radius * 2;
      sides.forEach(side => {
        // if (side.from.isWithin(this.from, searchRadius) || side.to.isWithin(this.to, searchRadius) ||
        //     side.from.isWithin(this.to, searchRadius) || side.to.isWithin(this.from, searchRadius)) {
        //   this.connectedSides.add(side);
        // }
        if (side.center.isWithin(this.center, settings.radius * 1)) {
          this.connectedSides.add(side);
        }
      });

      if (this.left && this.right) {
        const allowedEdges = Array.from(this.connectedSides);//.filter(s => s.height < this.height);
        const found = _.orderBy(allowedEdges, 'height', 'ASC');
        if (found.length > 0) {
          this.down = found[0];
        } else {
          // console.log(this);
          this.crest = true;
        }
      }
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
  /*
  let edges = [];
  let cornersByPoint = {};
  let cornerEdges = []; // 2D array of corner coordinates (x, y) to array of edges
  function addCornerEdge(corner, edge) {
    if (!cornerEdges[corner.point.x]) {
      cornerEdges[corner.point.x] = [];
    }
    if (!cornerEdges[corner.point.x][corner.point.y]) {
      cornerEdges[corner.point.x][corner.point.y] = [];
    }
    cornerEdges[corner.point.x][corner.point.y].push(edge);
  }
  diagram.edges.forEach((edge, index) => {
    edges[index] = new Edge(edge);
    // drawDot(ctx, new Point(edge.va.x, edge.va.y), 'yellow');
    const cornerFrom = new Corner(new Point(edge.va.x, edge.va.y), index);
    corners.push(cornerFrom);
    edges[index].from = cornerFrom;
    if (!cornersByPoint[edge.va.x]) {
      cornersByPoint[edge.va.x] = {};
    }
    cornersByPoint[edge.va.x][edge.va.y] = cornerFrom;
  });
  diagram.edges.forEach((edge, index) => {
    let cornerTo = cornersByPoint[edge.vb.x][edge.vb.y];
    if (!cornerTo) { // broken edge
      cornerTo = new Corner(new Point(edge.vb.x, edge.vb.y), index);
      corners.push(cornerTo);
    }
    edges[index].to = cornerTo;
    const cornerFrom = edges[index].from;

    addCornerEdge(cornerTo, edges[index]);
    addCornerEdge(cornerFrom, edges[index]);

    edges[index].connectedEdges = _(cornerEdges[cornerFrom.point.x][cornerFrom.point.y])
      .concat(cornerEdges[cornerTo.point.x][cornerTo.point.y])
      .remove(d => edges[index].id === d.id)
      .value();

    edges[index].center = new Point(
      (edges[index].from.point.x + edges[index].to.point.x) / 2,
      (edges[index].from.point.y + edges[index].to.point.y) / 2
    );
  });
  */

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
    console.log(activeCellsSet);
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
        cell.downstream = found;
        cell.flow = 0;
      } else { // drain in the ocean
        cell.downstream = found;
        cell.flow = 0;
      }
    });
  }

  // make rivers
  let rivers = [];
  cells.forEach(cell => {
    if (cell.water > settings.riverThreshold && cell.downstream) {
      let active = cell.downstream;
      let segments = [cell.downstream];
      while (true) {
        if (active.type === 'land' && active.downstream) {
          segments.push(active.downstream);
          active = active.downstream;
        } else {
          break;
        }
      }
      rivers.push(segments);
    }
  });


  console.log('cells', cells);
  console.log('sides', sides);


  // make rivers
  // edges
  //   .filter(edge => edge.left && edge.right && edge.downstream)
  //   .forEach(edge => {
  //     if (edge.water > 500 && edge.downstream) {
  //       let active = edge.downstream;
  //       const segments = [edge.downstream];
  //       while (true) {
  //         // if one of the cells next to this edge is ocean, then exit
  //         if (active.left.type === 'land' && active.right.type === 'land') {
  //           if (!active.downstream) break;
  //           segments.push(active.downstream);
  //           active = active.downstream;
  //         } else {
  //           break;
  //         }
  //       }
  //       rivers.push(segments);
  //     }
  //   });
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

  // for each cell, draw a line to its corners
  // if (settings.drawInnerEdges) {
  //   diagram.cells.forEach(cell => {
  //   	cell.halfedges.forEach(halfEdge => {
  //     	drawEdge(
  //       	ctx,
  //         new Point(cell.site.x, cell.site.y),
  //         new Point(halfEdge.edge.va.x, halfEdge.edge.va.y),
  //         0.5,
  //         'red'
  //       );
  //       drawEdge(
  //       	ctx,
  //         new Point(cell.site.x, cell.site.y),
  //         new Point(halfEdge.edge.vb.x, halfEdge.edge.vb.y),
  //         0.5,
  //         'red'
  //       );
  //     });
  //   });
  // }

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

  if (settings.drawRivers) {
    rivers.forEach(segments => {
      if (segments.length < 3) return;
      const {center, water} = segments[0];
      ctx.beginPath();
      ctx.strokeStyle = 'blue';
      ctx.moveTo(center.x, center.y);
      const points = [];
      for (let i = 1; i < segments.length - 1; i++) {
        const seg = segments[i];
        // ctx.lineTo(seg.center.x, seg.center.y);
        points.push(seg.center.x, seg.center.y);
      }
      const riverDelta = _.nth(segments, -2);
      const end = _.last(segments);
      // ctx.lineTo(
      //   (riverDelta.center.x + end.center.x) / 2,
      //   (riverDelta.center.y + end.center.y) / 2
      // );
      points.push(
        (riverDelta.center.x + end.center.x) / 2,
        (riverDelta.center.y + end.center.y) / 2
      );
      curve(ctx, points);
      ctx.stroke();
      ctx.closePath();
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
