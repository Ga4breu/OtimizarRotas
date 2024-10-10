import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleMap, LoadScript, DirectionsRenderer, Marker } from '@react-google-maps/api';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import MyLocationIcon from '@mui/icons-material/MyLocation';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const initialCenter = {
  lat: -25.5469,
  lng: -54.5882,
};

const Mapa = () => {
  const [zoom, setZoom] = useState(14);
  const [center, setCenter] = useState(initialCenter);
  const mapRef = useRef(null);
  const [addresses, setAddresses] = useState(['', '', '']);
  const [directions, setDirections] = useState(null);
  const [waypointsMarkers, setWaypointsMarkers] = useState([]);
  const [totalDistance, setTotalDistance] = useState(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  console.log(apiKey)

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const currentLocation = `${latitude}, ${longitude}`;
        const updatedAddresses = [...addresses];
        updatedAddresses[0] = currentLocation;
        setAddresses(updatedAddresses);
        if (mapRef.current) {
          mapRef.current.panTo({ lat: latitude, lng: longitude });
          mapRef.current.setZoom(14);
        }
      }, (error) => {
        console.error('Error fetching location:', error);
        alert('Unable to fetch your current location.');
      });
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleAddressChange = (index, value) => {
    const updatedAddresses = [...addresses];
    updatedAddresses[index] = value;
    setAddresses(updatedAddresses);
  };

  const handleOptimizeRoute = () => {
    const waypoints = addresses.slice(1, addresses.length - 1).filter((addr) => addr !== '');
    if (addresses[0] && addresses[addresses.length - 1]) {
      const directionsService = new window.google.maps.DirectionsService();
      const request = {
        origin: addresses[0],
        destination: addresses[addresses.length - 1],
        waypoints: waypoints.map((waypoint) => ({ location: waypoint, stopover: true })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      };

      directionsService.route(request, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);

          const legs = result.routes[0].legs;
          const distanceSum = legs.reduce((sum, leg) => sum + leg.distance.value, 0);
          setTotalDistance(distanceSum / 1000); // Convert to km

          setWaypointsMarkers([
            { location: result.routes[0].legs[0].start_location, label: { text: 'Start' }, key: 'start' },
            ...legs.map((leg, index) => ({
              location: leg.end_location,
              label: { text: `Stop ${index + 1}` },
              key: `stop_${index + 1}`,
            })),
          ]);

          const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(addresses[0])}&destination=${encodeURIComponent(addresses[addresses.length - 1])}&travelmode=driving&waypoints=${waypoints.map((wp) => encodeURIComponent(wp)).join('|')}`;
          setGoogleMapsUrl(url);
        } else {
          console.error('Error fetching directions:', result);
        }
      });
    } else {
      alert('Please fill in both the start and end addresses.');
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:h-[85vh] md:ml-[25%]">
      <div className="md:w-1/2 p-4 ">
        <div className="bg-gray-800 h-[400px] md:h-full">
          {apiKey && (
            <LoadScript googleMapsApiKey={apiKey}>
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={zoom}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{
                  streetViewControl: false,
                  disableDefaultUI: true,
                  zoomControl: true,
                  tilt: 0,
                  rotateControl: false,
                  mapTypeControl: false,
                  mapTypeId: "satellite"
                }}
              >
                {directions && (
                  <DirectionsRenderer
                    directions={directions}
                    options={{ suppressMarkers: true }}
                  />
                )}
                {waypointsMarkers.map((marker) => (
                  <Marker
                    key={marker.key}
                    position={marker.location}
                    label={{
                      text: marker.label.text,
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                ))}
              </GoogleMap>
            </LoadScript>
          )}
        </div>
      </div>
      <div className="mt-[5%]">
        {addresses.map((address, index) => (
          <div key={index} className="mb-2 flex items-center">
            <input
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(index, e.target.value)}
              placeholder={index === 0 ? "Início da Rota" : `Coloque o endereço ${index + 1}`}
              className="w-64 p-2"
            />
            {index === 0 && (
              <button
                className="bg-green-500 text-white ml-2 p-2 rounded-lg hover:bg-green-600"
                onClick={handleUseCurrentLocation}
              >
                <MyLocationIcon/>
              </button>
            )}
          </div>
        ))}
        <button
          className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600"
          onClick={handleOptimizeRoute}
        >
          Otimizar Rota
        </button>
        {totalDistance && (
          <div className="mt-2">
            <p className="text-gray-700">Distância total: {totalDistance.toFixed(2)} km</p>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Abrir no Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Mapa;
