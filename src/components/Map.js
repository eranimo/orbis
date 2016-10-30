import React, { Component } from 'react';
import poissonDiscSampler from '../utils/poissonDisk';
import Voronoi from 'voronoi';
import _ from 'lodash';
import DiamondSquare from '../utils/diamondSquare.js';


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

class Point {
	constructor(x, y) {
  	this.x = x;
    this.y = y;
  }
}

function drawDot(ctx, point, color = 'black') {
  ctx.beginPath();
  ctx.arc(point.x + 0.5, point.y + 0.5, 1, 0, 2 * Math.PI, false);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.closePath();
}

function drawEdge(ctx, p1, p2, width = 1, style = 'black') {
	ctx.beginPath();
  ctx.moveTo(parseInt(p1.x, 10) + 0.5, parseInt(p1.y, 10) + 0.5);
  ctx.lineTo(parseInt(p2.x, 10) + 0.5, parseInt(p2.y, 10) + 0.5);
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.stroke();
  ctx.closePath();
}

function drawArrow(ctx, fromx, fromy, tox, toy, r = 10){
	let x_center = tox;
	let y_center = toy;

	let angle;
	let x;
	let y;

	ctx.beginPath();

	angle = Math.atan2(toy - fromy, tox - fromx)
	x = 2 * r * Math.cos(angle) + x_center;
	y = 2 * r * Math.sin(angle) + y_center;

	ctx.moveTo(x, y);

	angle += (1 / 3) * (2 * Math.PI)
	x = r * Math.cos(angle) + x_center;
	y = r * Math.sin(angle) + y_center;

	ctx.lineTo(x, y);

	angle += (1 / 3) * (2 * Math.PI)
	x = r * Math.cos(angle) + x_center;
	y = r * Math.sin(angle) + y_center;

	ctx.lineTo(x, y);
	ctx.closePath();
	ctx.fill();
}

function drawTriangle(ctx, p1, p2, p3, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.fill();
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.strokeWidth = 1.5;
  ctx.stroke();
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
    radius: 10
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

  const getColorAtPoint = _.memoize(function getColorAtPoint(point) {
    const h = getHeightAtPoint(point);
    let color;

    if (h < seaLevelHeight - 20) {
      color = [30, 22, 75];
    } else if (h < seaLevelHeight - 20) {
      color = [38, 30, 75];
    } else if (h < seaLevelHeight - 10) {
      color = [44, 44, 87];
    } else if (h < seaLevelHeight) {
      color = [54, 54, 97];
    } else if(h < seaLevelHeight + 20) {
      color = [114, 156, 101];
    } else if(h < seaLevelHeight + 30) {
      color = [124, 160, 111];
    } else if(h < seaLevelHeight + 40) {
      color = [133, 169, 121];
    } else if(h < seaLevelHeight + 55) {
      color = [169, 185, 150];
    } else if(h < seaLevelHeight + 65) {
      color = [199, 216, 194];
    } else {
      color = [211, 222, 210];
    }
    return color;
  });

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

  if (settings.drawCells) {
    diagram.cells.forEach((cell, index) => {
      const color = getColorAtPoint(new Point(cell.site.x, cell.site.y));
      // let h = getHeightAtPoint(cell.site.x, cell.site.y);
      // h = parseInt(((h - minHeight) / maxHeight) * 255, 10)
      // const color = [h, h, h];
      ctx.fillStyle = colorToRGB(randomizeColor(color));
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.lineWidth = 1;
      const start = cell.halfedges[0].getStartpoint();
      ctx.moveTo(start.x, start.y);
      cell.halfedges.forEach((halfEdge, index) => {
        const end = halfEdge.getEndpoint();
        ctx.lineTo(end.x, end.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }

  // draw cell centers in red
  if (settings.drawCenterDot) {
    diagram.cells.forEach(cell => {
  		drawDot(ctx, new Point(cell.site.x, cell.site.y), 'red');
    });
  }

  if (settings.drawHeightMarkers) {
    diagram.cells.forEach((cell, index) => {
      ctx.font = '8px Fira Code';
      ctx.fillStyle = 'rgba(200, 200, 200, 0.75)';
      ctx.textAlign = "center";
      ctx.fillText(
        _.round(getHeightAtPoint(new Point(cell.site.x, cell.site.y)), 1),
        cell.site.x,
        cell.site.y
      );
    });
  }

  class Edge {
    constructor(edge) {
      this.edge = edge;
    }
  }
  let edges = [];

  class Corner {
    constructor(point, index) {
      this.point = point;
      this.edgeIndex = index;
      this.height = getHeightAtPoint(point);
    }
  }

  let corners = [];
  let cornersByPoint = {};
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
    const cornerTo = cornersByPoint[edge.vb.x][edge.vb.y];
    if (!cornerTo) { // broken edge
      return
    }
    edges[index].to = cornerTo;
    const cornerFrom = edges[index].from;

    if (cornerFrom.height < cornerTo.height) {
      edges[index].up = cornerTo;
      edges[index].down = cornerFrom;
    } else {
      edges[index].up = cornerFrom;
      edges[index].down = cornerTo;
    }

    edges[index].center = new Point(
      (edges[index].from.point.x + edges[index].to.point.x) / 2,
      (edges[index].from.point.y + edges[index].to.point.y) / 2
    );
  });
  // clean up broken edges
  edges = edges.filter(edge => Object.keys(edge).length > 2);

  if (settings.drawElevationArrows) {
    ctx.fillStyle = 'black';
    edges.forEach(edge => {
      if (getHeightAtPoint(edge.center) >= seaLevelHeight) {
        drawArrow(
          ctx,
          edge.up.point.x,
          edge.up.point.y,
          edge.center.x,
          edge.center.y,
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
      const color = colorToRGB(getColorAtPoint(center));
      // left side
      if (edge.edge.lSite) {
        drawTriangle(
          ctx,
          edge.from.point,
          edge.edge.lSite,
          edge.to.point,
          color
        );
      }

      // right side
      if (edge.edge.rSite) {
        drawTriangle(
          ctx,
          edge.from.point,
          edge.edge.rSite,
          edge.to.point,
          color
        );
      }
    });
  }
  console.log(edges);


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
    diagram.edges.forEach(edge => {
      const leftHeight = getHeightAtPoint(new Point(edge.lSite.x, edge.lSite.y));
      const rightHeight = edge.rSite ? getHeightAtPoint(new Point(edge.rSite.x, edge.rSite.y)) : Infinity;
      let color;

      // color lines between water cells like the cell color
      // if (leftHeight < seaLevelHeight && rightHeight < seaLevelHeight) {
      //   color = colorToRGB(getColorAtPoint(new Point(edge.lSite.x, edge.lSite.y)));
      // } else {
      color = '#333';
    	drawEdge(
      	ctx,
      	new Point(edge.va.x, edge.va.y),
        new Point(edge.vb.x, edge.vb.y),
        1,
        color
      );
    });
  }

  // for each cell, draw a line to its corners
  if (settings.drawInnerEdges) {
    diagram.cells.forEach(cell => {
    	cell.halfedges.forEach(halfEdge => {
      	drawEdge(
        	ctx,
          new Point(cell.site.x, cell.site.y),
          new Point(halfEdge.edge.va.x, halfEdge.edge.va.y),
          0.5,
          'red'
        );
        drawEdge(
        	ctx,
          new Point(cell.site.x, cell.site.y),
          new Point(halfEdge.edge.vb.x, halfEdge.edge.vb.y),
          0.5,
          'red'
        );
      });
    });
  }
}


class Map extends Component {
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
      radius: 15,
      drawCells: true,
      drawTriangles: false,
      drawEdges: false,
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

export default Map;
