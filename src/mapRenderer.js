import _ from 'lodash';
import { curve } from 'cardinal-spline-js/curve_func.js';

import { drawDot, drawEdge, drawArrow, drawTriangle } from './draw';
import Point from './point';


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

export default function renderMap(canvas, map, settings = {}) {
  settings = Object.assign({}, {
    width: 500,
    heigth: 500,
    drawElevationArrows: false,
    drawCells: true,
    drawEdges: true,
    drawNeighborNetwork: true,
    drawCenterDot: true,
    drawHeightMarkers: false,
    drawCellWaterAmount: false
  }, settings);
  const ctx = canvas.getContext('2d');

  canvas.width = settings.width;
  canvas.height = settings.height;

  const contours = {
    [map.seaLevelHeight - 20]: [30, 22, 75],
    [map.seaLevelHeight - 20]: [38, 30, 75],
    [map.seaLevelHeight - 10]: [44, 44, 87],
    [map.seaLevelHeight]: [54, 54, 97],
    [map.seaLevelHeight + 20]: [114, 156, 101],
    [map.seaLevelHeight + 30]: [124, 160, 111],
    [map.seaLevelHeight + 40]: [133, 169, 121],
    [map.seaLevelHeight + 55]: [169, 185, 150],
    [map.seaLevelHeight + 65]:[199, 216, 194],
    [Infinity]: [211, 222, 210]
  };

  const getColorForHeight = _.memoize(function getColorForHeight(h) {
    for (const height of Object.keys(contours)) {
      if (h < height) {
        return contours[height];
      }
    }
  });

  // drawing
  if (settings.drawCells) {
    map.cells.forEach(cell => {
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
    map.cells.forEach(cell => {
      if (cell.type === 'land' && cell.downstream) {
        drawArrow(
          ctx,
          cell.downstream.center,
          cell.center,
          3
        );
      }
    });
  }

  // draw lines to neighbors
  if (settings.drawNeighborNetwork) {
    map.diagram.cells.forEach(cell => {
      const neighbors = cell.getNeighborIds();
      neighbors.forEach(index => {
        const neighbor = map.diagram.cells[index];
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
    map.sides.forEach(side => {
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
    map.cells.forEach(cell => {
      if (cell.height >= map.seaLevelHeight) {
        ctx.font = '8px Fira Code';
        ctx.fillStyle = 'white';
        ctx.textAlign = "center";
        ctx.fillText(
          _.round(cell.height - map.seaLevelHeight, 1),
          cell.center.x,
          cell.center.y + 5
        );
      }
    });
  }

  if (settings.drawDistanceFromCoast) {
    map.cells.forEach(cell => {
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

  const avgWater = _.meanBy(map.cells, 'water');
  function decideRiverWidth(cell) {
    if (cell.water > avgWater) return 2;
    return 1;
  }

  if (settings.drawRivers) {
    map.rivers.forEach(segment => {
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
    map.cells.forEach(cell => {

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
    map.sides.forEach(side => {
      // draw an arrow from each edge center to its downstream edge center
      if (side.down) {
        drawArrow(ctx, side.center, side.down.center, 5, 'rgba(255, 0, 0, 0.75)');
        drawEdge(ctx, side.center, side.down.center, 2,  'rgba(255, 0, 0, 0.75)');
      }
    });
  }


  if (settings.drawEdgeHeight) {
    map.sides.filter(c => c.crest).forEach(side => {
      drawDot(ctx, side.center, 'purple', 3);
    });
    ctx.font = '7px Fira Code';
    ctx.fillStyle = 'black';
    ctx.textAlign = "center";
    map.sides.forEach(side => {
      ctx.fillText(
        _.round(side.height, 1) || '',
        side.center.x,
        side.center.y + 10
      );
    })
    ctx.fillStyle = 'white';
    map.sides.forEach(side => {
      ctx.fillText(
        _.round(side.height, 1) || '',
        side.center.x + 1,
        side.center.y + 11
      );
    })
  }

  // draw cell centers in red
  if (settings.drawCenterDot) {
    map.diagram.cells.forEach(cell => {
  		drawDot(ctx, new Point(cell.site.x, cell.site.y), 'red');
    });
  }

}
