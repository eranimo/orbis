import nj from 'numjs';
import _ from 'lodash';


const DEBUG = true;


class River {
  get size() {
    let count = 0;
    let active = this.next;
    while(active !== null) {
      count++;
      active = active.next;
    }
    return count;
  }
}

class Lake {
  constructor(cells, upstreamSegment) {
    this.cells = cells;
    this.upstreamSegment = upstreamSegment;
    this.next = null;
  }

  get size() {
    return this.cells.size;
  }
}

class RiverSegment {
  constructor(cell, count) {
    this.cell = cell;
    this.count = count;
    this.next = null; // Lake or RiverSegment
  }
}


// makes an island by raising the water level then stopping
// when one of the pixels is lower in height than the last level
// this pixel has a downhill neighbor and can be made in to a river
export function fillLake(cell) {
  if (DEBUG) console.group(`Lake at ${cell}`);

  /*
  MAKE A LAKE
  The goal is to find the pixel where the lake overfills
  and move the cell's water there

  - at the starting cell, do a flood fill for <= cell.height + waterLevel, starting at waterLevel = 1
    and raising each iteration
  - stop the loop when the flood fill captures a cell with a lower height than
    any cell in the last iteration
  */
  const lake = new Set();
  let waterLevel = 1;
  let lastIterationFloodSet = null;
  let spill = null;

  while(spill === null) {
    if (DEBUG) console.log(`Raising water level to ${waterLevel}`);
    const results = cell.flood(c => c.height <= cell.height + waterLevel);
    lastIterationFloodSet = results;
    if (results.size === 0) {
      break;
    }
    for (const c of results) {
      c.isLake = true;
      lake.add(c);
    }
    if (lastIterationFloodSet) {
      for (const c1 of results) {
        for (const c2 of lastIterationFloodSet) {
          if (c1.height < c2.height) {
            spill = c1;
          }
        }
      }
    }
    waterLevel++;
  }
  if (spill === null) {
    if (DEBUG) console.log(`Couldn't create a lake, flood set was empty.`);
    if (DEBUG) console.log(cell);
    debugger;
    return null;
  }

  if (DEBUG) console.log(`Spill cell:`);
  if (DEBUG) console.log(spill);
  if (DEBUG) console.log(`Lake size: ${lake.size}`);
  if (DEBUG) console.log(`Lake water level ${waterLevel}`);
  if (DEBUG) console.groupEnd(`Lake at ${cell}`);

  return { lake, spill, cell };
}

// make a river from the source cell to the ocean or the edge of this tile
function makeRiver(sourceCell) {
  console.log(sourceCell);
  let activeCell = sourceCell;
  const river = new River();
  let lastSegment = river;
  let count = 1;

  while(activeCell.isLand && !activeCell.isEdge) {
    console.log(count, activeCell);
    if (activeCell.downhillCells.length > 0) {
      activeCell.isRiver = true;
      const segment = new RiverSegment(activeCell, count);
      lastSegment.next = segment;
      lastSegment = segment;

      const downhill = activeCell.downhillCells[0];
      if (downhill.isRiver) {
        // this is a river, end here
        break;
      } else {
        // make a river
        activeCell = activeCell.downhillCells[0];
      }
    } else {
      // make a lake
      const { lake: lakeCells, spill } = fillLake(activeCell);
      spill.isSpill = true;
      activeCell.isRiverMouth = true;
      const lake = new Lake(lakeCells, activeCell);
      // TODO: river segments inside this lake must be removed
      lastSegment.next = lake;
      lastSegment = lake;
      activeCell = spill; // connect lake to river
    }
    count++;
  }
  console.log('river', river);
  console.log('activeCell', activeCell);
  return river;
}


export default function makeRivers(tile) {
  const rivers = [];

  rivers.push(makeRiver(tile.getCell(214, 334)));

  // find river source cells
  // let riverSources = [];
  // tile.forEachCell(cell => {
  //   if (cell.downhillCells.length > 0 && cell.altitude > 20) {
  //     riverSources.push(cell);
  //   }
  // });
  //
  // riverSources = _.take(riverSources, 1);
  //
  // // make rivers
  // riverSources.forEach(sourceCell => {
  //   rivers.push(makeRiver(sourceCell));
  // });

  return rivers;
}
