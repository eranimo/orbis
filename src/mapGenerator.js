import poissonDiscSampler from './utils/poissonDisk';
import Voronoi from 'voronoi';
import Point from './point';
import DiamondSquare from './utils/diamondSquare';
import Random from './utils/random';


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

function guid(random) {
  function s4() {
    return Math.floor((1 + random.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

export default function generateMap(settings) {
  settings = Object.assign({}, {
    radius: 10,
    cellInitialWater: 5,
    riverThreshold: 50,
    width: 900,
    height: 700,
    rivers: true
  }, settings);

  const random = new Random(settings.seed);

  // get Poisson-Disc dots
  const sampler = poissonDiscSampler(settings.width, settings.height, settings.radius, random);
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
    edge.id = guid(random);
    return edge;
  });
  console.timeEnd('voronoi computing');

  console.log(diagram);

  console.time('diamond square');
  // console.profile('diamond square');
  const HEIGHTMAP_SIZE = 256;
  const smallerHeightmap = new DiamondSquare({
    size: HEIGHTMAP_SIZE
  }, random);
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
      cell.height = seaLevelHeight + (cell.distanceFromCoast * 7 + random.real(1.0, 3.9));
    }
    return cell;
  });
  let rivers = [];

  if (settings.rivers) {
    // river flow
    console.time('rivers');
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


    // calculate cell distance from river
    // TODO: use # of cells between instead of pixel distance
    cells.forEach(cell => {
      if (cell.type === 'ocean') return;
      if (cell.isRiver) {
        cell.distanceFromRiver = 0;
        return;
      }

      let min = Infinity;
      cells.forEach(c => {
        if (c == cell) return;
        if (!c.isRiver) return;
        const dist = cell.center.distanceTo(c.center);
        if (dist < min) {
          min = dist;
        }
      });
      cell.distanceFromRiver = min / settings.radius;

    });
    console.timeEnd('rivers');
  }

  return { seaLevelHeight, cells, sides, rivers, diagram, heightmap: smallerHeightmap };
}
