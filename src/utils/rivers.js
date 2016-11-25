import _ from 'lodash';


class RiverSegment {
  constructor(cell) {
    this.cell = cell;
    this.next = null;
  }

  get countDownhill() {
    let count = 0;
    let current = this;
    while(current !== null) {
      current = current.next;
      count++;
    }
    return count;
  }
}

function riverStep(cell) {
  const segment = new RiverSegment(cell);
  cell.isRiver = true;
  const take = _.random(0, 50) === 0 ? 2 : 1;
  const uphill = _.take(_.filter(cell.uphillCells, c => c.isRiver === false), take);
  segment.next = [];
  uphill.forEach(c => {
    segment.next.push(riverStep(c));
  })
  return segment;
}

/*
  Make rivers from the coastlines of this tile
*/
export function makeRivers(tile) {
  /*
  1. Find coastal cells
  2. Pick a certain % of them
  3. for each picked cell create a linked list going uphill,
     with a certain chance to branch
  4. Stop when there is no uphill cells
  */

  const pickedCells = _.take(_.shuffle(tile.getCoastalCells()), 5);

  let rivers = [];
  if (pickedCells.length > 0) {
    pickedCells.forEach(cell => {
      rivers.push(riverStep(cell));
    })
  }

  return rivers;

}


/* Extend rivers from neighboring tiles
 */
export function extendRivers(tile) {
  /*
  1. Look for river segments on the edge of each neighboring tile
  */
}
