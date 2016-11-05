/* @flow */
import React, { Component } from 'react';
import renderMap from '../mapRenderer';
import generateMap from '../mapGenerator';
import { observable, observe } from 'mobx';
import { observer, Provider } from 'mobx-react';

class LocalStorageSync {
  constructor() {
    const key = 'MapUIState';
    if (window.localStorage[key]) {
      this.settings = JSON.parse(window.localStorage[key]);
    } else {
      window.localStorage[key] = JSON.stringify(this.settings);
    }
    observe(this.settings, change => {
      const newSettings = JSON.parse(window.localStorage[key]);
      newSettings[change.name] = change.newValue;
      window.localStorage[key] = JSON.stringify(newSettings);
    });
  }
}

class MapUIState extends LocalStorageSync {
  @observable settings = {
    drawEdges: true,
    drawRivers: true,
    drawHeightMarkers: false,
    drawCellWaterAmount: false
  }
}


@observer
class WorldMap extends Component {
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
    const { settings } = this.props.mapUIState;
    console.group('Map draw');
    console.time('total draw');
    renderMap(this.refs.board, this.map, {
      width: 1500,
      height: 700,

      drawSideSlopeArrows: false,
      drawEdgeHeight: false,
      drawRivers: settings.drawRivers,
      drawCells: true,
      drawEdges: settings.drawEdges,
      drawCellWaterAmount: settings.drawCellWaterAmount,
      drawHeightMarkers: settings.drawHeightMarkers,
      drawElevationArrows: false,
      drawNeighborNetwork: false,
      drawCenterDot: false
    });
    console.timeEnd('total draw');
    console.groupEnd();
  }
  handleToggle(key) {
    return () => {
      this.props.mapUIState.settings[key] = !this.props.mapUIState.settings[key];
    }
  }
  render() {
    const { settings } = this.props.mapUIState;
    console.log(settings);
    return (
      <div>
        <div>
          <h2>Controls</h2>
          <div>
            Draw sides <input type="checkbox" checked={settings.drawEdges} onChange={this.handleToggle.call(this, 'drawEdges')} />
            Draw rivers <input type="checkbox" checked={settings.drawRivers} onChange={this.handleToggle.call(this, 'drawRivers')} />
            Draw height markers <input type="checkbox" checked={settings.drawHeightMarkers} onChange={this.handleToggle.call(this, 'drawHeightMarkers')} />
            Draw water amount <input type="checkbox" checked={settings.drawCellWaterAmount} onChange={this.handleToggle.call(this, 'drawCellWaterAmount')} />
          </div>
          <button onClick={this.init.bind(this)}>Regenerate</button>
          <button onClick={this.redraw.bind(this)}>Redraw</button>
        </div>
        <canvas ref="board"></canvas>
      </div>
    )
  }
}

export default () => {
  const state = new MapUIState();
  return <WorldMap mapUIState={state} />
}
