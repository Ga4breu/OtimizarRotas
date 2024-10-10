// src/App.js
import React from 'react';
import Navbar from './components/Navbar';
import Mapa from './components/Mapa';

function App() {
  return (
    <div className="text-center flex flex-col justify-center items-center md:block">
      <Navbar />
      <Mapa />

    </div>
  );
}

export default App;
