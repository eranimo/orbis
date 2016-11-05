/* @flow */
import React, { Component } from 'react';
import renderMap from '../mapRenderer';
import generateMap from '../mapGenerator';


class WorldMap extends Component {
  state = {
    drawEdges: true,
    drawRivers: true,
    drawHeightMarkers: false,
    drawCellWaterAmount: false
  }
  componentDidMount() {
    this.init();
  }
  redraw() {
    this.draw();
  }
  init() {
    this.generate();
    this.draw();
  }
  generate() {
    this.map = generateMap({
      radius: 20,
      width: 1500,
      height: 700,
    });
  }
  componentDidUpdate() {
    this.draw();
  }
  draw() {
    console.group('Map draw');
    console.time('total draw');
    renderMap(this.refs.board, this.map, {
      width: 1500,
      height: 700,

      drawSideSlopeArrows: false,
      drawEdgeHeight: false,
      drawRivers: this.state.drawRivers,
      drawCells: true,
      drawEdges: this.state.drawEdges,
      drawCellWaterAmount: this.state.drawCellWaterAmount,
      drawHeightMarkers: this.state.drawHeightMarkers,
      drawElevationArrows: false,
      drawNeighborNetwork: false,
      drawCenterDot: false
    });
    console.timeEnd('total draw');
    console.groupEnd();
  }
  handleToggle(key) {
    return () => {
      this.setState({
        [key]: !this.state[key]
      })
    }
  }
  render() {
    return (
      <div>
        <div>
          <h2>Controls</h2>
          <div>
            Draw sides <input type="checkbox" checked={this.state.drawEdges} onChange={this.handleToggle.call(this, 'drawEdges')} />
            Draw rivers <input type="checkbox" checked={this.state.drawRivers} onChange={this.handleToggle.call(this, 'drawRivers')} />
            Draw height markers <input type="checkbox" checked={this.state.drawHeightMarkers} onChange={this.handleToggle.call(this, 'drawHeightMarkers')} />
            Draw water amount <input type="checkbox" checked={this.state.drawCellWaterAmount} onChange={this.handleToggle.call(this, 'drawCellWaterAmount')} />
          </div>
          <button onClick={this.init.bind(this)}>Regenerate</button>
          <button onClick={this.redraw.bind(this)}>Redraw</button>
        </div>
        <canvas ref="board"></canvas>
      </div>
    )
  }
}

export default WorldMap;
