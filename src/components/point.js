/* @flow */
import _ from 'lodash';


export default class Point {
  x: number | [number] | {x: number, y: number};
  y: number | [number] | {x: number, y: number};
	constructor(one, two) {
    if (_.isObject(one) && one.x && one.y) {
      this.x = one.x;
      this.y = one.y;
    } else if (_.isArray(one) && one.length === 2){
      this.x = one[0];
      this.y = one[1];
    } else {
    	this.x = one;
      this.y = two;
    }
  }

  distanceTo(point) {
    return Math.sqrt(Math.pow(point.x - this.x, 2) + Math.pow(point.y - this.y, 2));
  }

  randomWithin(distance) {
    return new Point(
      this.x + _.random(distance),
      this.y + _.random(distance)
    )
  }

  between(point) {
    return new Point(
      (this.x + point.x) / 2,
      (this.y + point.y) / 2
    );
  }

  isEqual(point) {
    return this.x === point.x && this.y === point.y;
  }

  isWithin(point: Point, within: number): boolean {
    return _.inRange(Math.abs(this.x - point.x), within) &&
           _.inRange(Math.abs(this.y - point.y), within)
  }

  round(amount = 0) {
    this.x = _.round(this.x, amount);
    this.y = _.round(this.y, amount);
    return this;
  }

  up(amount) {
    this.y -= amount;
    return this;
  }

  down(amount) {
    this.y += amount;
    return this;
  }

  clone() {
    return new Point(this.x, this.y, 'pink', 40);
  }

  toString() {
    return `Point(x: ${this.x} y: ${this.y})`;
  }
}
