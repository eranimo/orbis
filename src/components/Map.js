/* @flow */
import React, { Component, PropTypes } from 'react';
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
    drawEdges: false,
    drawRivers: true,
    drawHeightMarkers: false,
    drawCellWaterAmount: false,
    drawRiverDistance: false
  }
}


class Map {
  @observable settings = {
    radius: 15,
    width: 1500,
    height: 700,
    riverThreshold: 250,
    seed: undefined
  }

  @observable data = null;

  generate() {
    this.data = generateMap(this.settings);
    console.log(this.data);
  }
}


@observer
class HeightmapViewer extends Component {
  static propTypes = {
    heightmap: PropTypes.object
  }
  componentDidMount() {
    this.draw();
  }
  componentDidUpdate(){
    this.draw();
  }
  draw() {
    const heightmap = this.props.heightmap;
    if (heightmap) {
      const canvas = this.refs.map;
      canvas.width = heightmap.size;
      canvas.height = heightmap.size;
      const ctx = canvas.getContext('2d');
      console.log(heightmap);
      for (let x = 0; x < heightmap.size; x++) {
        for (let y = 0; y < heightmap.size; y++) {
          const height = parseInt(heightmap.get(x, y), 10);
          ctx.fillStyle = `rgb(${height}, ${height}, ${height})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  render() {
    return (
      <canvas ref="map" />
    )
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
      drawRiverDistance: settings.drawRiverDistance,
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
            <br />
            Draw river distance:
            <input
              type="checkbox"
              checked={mapUIState.settings.drawRiverDistance}
              onChange={this.toggleUIState.call(this, 'drawRiverDistance')}
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

            Seed
            <input
              type="text"
              value={map.settings.seed}
              placeholder="Empty for random seed"
              onChange={this.setMapOption.call(this, 'seed')}
            />

            <div>
              <HeightmapViewer heightmap={this.props.map.data ? this.props.map.data.heightmap : {}} />
            </div>
          </div>
          <div>
            <button onClick={this.init.bind(this)}>Regenerate</button>
            <button onClick={this.redraw.bind(this)}>Redraw</button>
          </div>
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
