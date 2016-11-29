import nj from 'numjs';
import _ from 'lodash';


const DEBUG = true;


class River {
  get segmentSize() {
    let count = 0;
    let active = this.next;
    while(active !== null) {
      count++;
      active = active.next;
    }
    return count;
  }

  get totalCellSize() {
    let count = 0;
    let active = this.next;
    while(active !== null) {
      if (active.cell && active.cell.isRiver) {
        count++;
      } else if (active.cells) {
        count += active.cells.size;
      }
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
  let waterLevel = cell.height;
  let lastIterationFloodSet = null;
  let spill = null;

  while(spill === null) {
    if (DEBUG) console.log(`Raising water level to ${waterLevel}`);

    const results = cell.flood(
      c => c.isLand && // cell must be land
      c.height <= waterLevel && // and <= to the current water level
      // (!c.isLake || c.lakeSet !== lake) && // not a lake or part of this lake already
      !c.isRiver // can't also be a river
    );
    if (DEBUG) console.log(`${results.size} cells found`);

    if (results.size === 0) {
      break;
    }

    let lastMinHeight;
    if (lastIterationFloodSet) {
      lastMinHeight = _.minBy(Array.from(lastIterationFloodSet), 'height');
      console.log(`Last round min height: ${lastMinHeight.height}`)
    }

    for (const c of results) {
      if (lastIterationFloodSet) {
        if (c.height < lastMinHeight.height) {
          spill = c;
          break;
        }
      }
      c.isLake = true;
      // c.lakeSet = lake;
      lake.add(c);
    }

    // exit condition
    // raise the water until a cell on the outer edge has a downhill neighbor that isn't a lake
    // for (const c1 of results) {
      // const outerEdgeCells = _.orderBy(_.filter(c1.neighbors, c => !c.isLake && !c.isRiver), 'height', 'ASC');
      // if (outerEdgeCells.length > 0) {
      //   // if (DEBUG) console.log(`Looking at ${outerEdgeCells.length} uphill cells not in a lake`);
      //   outerEdgeCells.forEach(c2 => {
      //     if (c2.downhillCells.length > 0) {
      //       spill = c2;
      //     }
      //   });
      // }
    // }

    // if (lastIterationFloodSet) {
    //   const lastMin = _.minBy(Array.from(lastIterationFloodSet), 'height');
    //   const thisMin = _.minBy(Array.from(results), 'height');
    //   if (thisMin && DEBUG) console.log(`min height this round: ${thisMin.height}`);
    //   if (lastMin && DEBUG) console.log(`min height last round: ${lastMin.height}`);
    //   if (thisMin !== lastMin && thisMin.height < lastMin.height) {
    //     if (DEBUG) console.log(`Finished with river: lake when down in elevation. ${thisMin.id} is less than ${lastMin.id}`);
    //     spill = thisMin;
    //   }
    // }
    lastIterationFloodSet = results;
    waterLevel++;
  }
  if (spill === null) {
    if (DEBUG) console.log(`Couldn't create a lake, flood set was empty.`);
    if (DEBUG) console.log(cell);
    if (DEBUG) console.log(lastIterationFloodSet);
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
    if (activeCell.downhillLandCells.length > 0) {
      console.log('river');
      activeCell.isRiver = true;
      const segment = new RiverSegment(activeCell, count);
      lastSegment.next = segment;
      lastSegment = segment;

      const downhill = activeCell.downhillLandCells[0];
      if (downhill.isRiver) {
        // this is a river, end here
        console.log('downhill is a river:', downhill);
        break;
      } else {
        // make a river
        activeCell = activeCell.downhillLandCells[0];
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
  console.group('Make rivers');
  rivers.push(makeRiver(tile.getCell(214, 334)));
  console.groupEnd('Make rivers');

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
