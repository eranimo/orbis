import React from 'react';
import ReactDom from 'react-dom';
import TileView from './components/TileView';


function App() {
  return (
    <div>
      <TileView />
    </div>
  )
}

ReactDom.render(<App />, document.getElementById('app'));
