// src/App.js
import React from 'react';
import Navbar from './components/Navbar';
import Mapa from './components/Mapa';
import Information from './components/Information';

function App() {
  return (
    <div className="text-center flex flex-col justify-center items-center">
      <Navbar />
      <Mapa />
      <Information />
    </div>
  );
}

export default App;
