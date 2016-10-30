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


function renderMap(canvas, settings = {}) {
  settings = Object.assign({}, {
    width: 500,
    heigth: 500,
    drawCell: true,
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

  function getHeight(x, y) {
    return smallerHeightmap.get(
      Math.floor(x / (settings.width / HEIGHTMAP_SIZE * 2)),
      Math.floor(y / (settings.height / HEIGHTMAP_SIZE * 2))
    );
  }
  const getHeightMemoized = _.memoize(getHeight);

  function getColorFor(x, y) {
    const h = getHeightMemoized(x, y);
    let color;
    if (h < seaLevelHeight) {
      color = [54, 54, 97];
    } else if(h < seaLevelHeight + 20) {
      color = [114, 156, 101];
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
  }
  const getColorForMemoized = _.memoize(getColorFor);

  function colorToRGB (color) {
    return `rgb(${color.map(c => c.toString()).join(', ')})`;
  }

  if (settings.drawCell) {
    diagram.cells.forEach((cell, index) => {
      const color = getColorForMemoized(cell.site.x, cell.site.y)
      // let h = getHeightMemoized(cell.site.x, cell.site.y);
      // h = parseInt(((h - minHeight) / maxHeight) * 255, 10)
      // const color = [h, h, h];
      ctx.fillStyle = colorToRGB(color);
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

  // draw voronoi edges
  if (settings.drawEdges) {
    diagram.edges.forEach(edge => {
      const leftHeight = getHeightMemoized(edge.lSite.x, edge.lSite.y);
      const rightHeight = edge.rSite ? getHeightMemoized(edge.rSite.x, edge.rSite.y) : Infinity;
      let color;

      // color lines between water cells like the cell color
      if (leftHeight < seaLevelHeight && rightHeight < seaLevelHeight) {
        color = colorToRGB(getColorForMemoized(edge.lSite.x, edge.rSite.y));
      } else {
        color = '#333';
      }
    	drawEdge(
      	ctx,
      	new Point(edge.va.x, edge.va.y),
        new Point(edge.vb.x, edge.vb.y),
        1,
        color
      );
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

  // for each cell, draw a line to its corners
  if (settings.drawInnerEdges) {
    diagram.cells.forEach(cell => {
    	cell.halfedges.forEach(halfEdge => {
      	drawEdge(
        	ctx,
          new Point(cell.site.x, cell.site.y),
          new Point(halfEdge.edge.va.x, halfEdge.edge.va.y),
          0.1,
          'green'
        );
        drawEdge(
        	ctx,
          new Point(cell.site.x, cell.site.y),
          new Point(halfEdge.edge.vb.x, halfEdge.edge.vb.y),
          0.1,
          'green'
        );
      });
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
        _.round(getHeightMemoized(cell.site.x, cell.site.y), 1),
        cell.site.x,
        cell.site.y
      );
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
      drawEdges: true,
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
