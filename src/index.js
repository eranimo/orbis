import React from 'react';
import ReactDom from 'react-dom';
import Map from './components/Map';


function App() {
  return (
    <div>
      <h1>Orbis</h1>
      <Map />
    </div>
  )
}

ReactDom.render(<App />, document.getElementById('app'));
