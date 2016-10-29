import React, { Component } from 'react';
import poissonDiscSampler from '../utils/poissonDisk';
import Voronoi from 'voronoi';
import _ from 'lodash';


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

  let cellHeights = [];

  function step(cell, index, height, direction){
    if (cellHeights[index]) {
      return;
    }
    cellHeights[index] = height;
    const neighbors = _.shuffle(cell.getNeighborIds());
    neighbors.forEach(index => {
      let add;
      if (_.inRange(height, 0, 100)) {
        add = _.random(1, 10);
      } else if (_.inRange(height, 100, 200)) {
        add = _.random(-5, 5);
      } else {
        add = _.random(-10, -1);
      }
      step(diagram.cells[index], index, height + add);
    });
  }
  step(diagram.cells[0], 0, _.random(100, 200), 'up');

  let minHeight = _.min(cellHeights);
  let maxHeight = _.max(cellHeights);


  if (settings.drawCell) {
    diagram.cells.forEach((cell, index) => {
      // const i = parseInt(((cellHeights[index] - minHeight) / maxHeight) * 255, 10);
      // ctx.fillStyle = `rgb(${i}, ${i}, ${i})`;
      if (cellHeights[index] < (maxHeight - minHeight / 2)) {
        ctx.fillStyle = 'skyblue';
      } else {
        ctx.fillStyle = 'green';
      }
      ctx.strokeStyle = '#333';
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
    	drawEdge(
      	ctx,
      	new Point(edge.va.x, edge.va.y),
        new Point(edge.vb.x, edge.vb.y),
        1,
        '#333'
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
      radius: 20,
      drawEdges: false,
      drawNeighborNetwork: false,
      drawInnerEdges: false
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
