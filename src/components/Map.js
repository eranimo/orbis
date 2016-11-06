/* @flow */
import React, { Component } from 'react';
import renderMap from '../mapRenderer';
import generateMap from '../mapGenerator';
import { observable, observe } from 'mobx';
import { observer, Provider } from 'mobx-react';
import _ from 'lodash';



function localStorageSync(storageKey, property) {
  if (window.localStorage[storageKey]) {
    property = JSON.parse(window.localStorage[storageKey]);
  } else {
    window.localStorage[storageKey] = JSON.stringify(property);
  }
  observe(property, change => {
    const newSettings = JSON.parse(window.localStorage[storageKey]);
    newSettings[change.name] = change.newValue;
    window.localStorage[storageKey] = JSON.stringify(newSettings);
  });
}


class MapUIState {
  @observable settings = {
    drawEdges: true,
    drawRivers: true,
    drawHeightMarkers: false,
    drawCellWaterAmount: false
  }
}


class Map {
  @observable settings = {
    radius: 20,
    width: 1500,
    height: 700,
    riverThreshold: 50
  }

  @observable data = null;

  generate() {
    this.data = generateMap(this.settings);
  }
}


@observer
class MapViewer extends Component {
  componentDidMount() {
    this.init();
  }
  redraw() {
    this.draw();
  }
  init() {
    this.props.map.generate();
    this.draw();
  }
  // componentDidUpdate(nextProps) {
  //   this.draw();
  // }
  draw() {
    const { settings } = this.props.mapUIState;
    console.group('Map draw');
    console.time('total draw');
    renderMap(this.refs.board, this.props.map.data, {
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
  toggleUIState(key) {
    return () => {
      this.props.mapUIState.settings[key] = !this.props.mapUIState.settings[key];
    }
  }
  setMapOption(key) {
    return (event) => {
      this.props.map.settings[key] = event.target.value;
    }
  }
  updateValue(ref, key) {
    this.props.mapUIState.settings[key] = this.refs[ref].value;
    this.init();
  }
  render() {
    const { mapUIState, map } = this.props;
    return (
      <div>
        <div className="row">
          <div className="col-md-6">
            <h2>Map Controls</h2>
            Draw sides
            <input
              type="checkbox"
              checked={mapUIState.settings.drawEdges}
              onChange={this.toggleUIState.call(this, 'drawEdges')}
            />

            Draw rivers
            <input
              type="checkbox"
              checked={mapUIState.settings.drawRivers}
              onChange={this.toggleUIState.call(this, 'drawRivers')}
            />
            <br />
            Draw height markers:
            <input
              type="checkbox"
              checked={mapUIState.settings.drawHeightMarkers}
              onChange={this.toggleUIState.call(this, 'drawHeightMarkers')}
            />

            Draw water amount
            <input
              type="checkbox"
              checked={mapUIState.settings.drawCellWaterAmount}
              onChange={this.toggleUIState.call(this, 'drawCellWaterAmount')}
            />

          </div>
          <div className="col-md-6">
            <h2>Generator Options</h2>
            River threshold
            <input
              type="text"
              value={map.settings.riverThreshold}
              onChange={this.setMapOption.call(this, 'riverThreshold')}
            />
          </div>
          <button onClick={this.init.bind(this)}>Regenerate</button>
          <button onClick={this.redraw.bind(this)}>Redraw</button>
        </div>
        <canvas ref="board"></canvas>
      </div>
    )
  }
}

export default observer(function () {
  const mapUIState = new MapUIState();
  const map = new Map();
  return <MapViewer mapUIState={mapUIState} map={map} />
})
