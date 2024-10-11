import React, { useState, useRef, useCallback } from 'react';
import { GoogleMap, LoadScript, DirectionsRenderer, Marker } from '@react-google-maps/api';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import MyLocationIcon from '@mui/icons-material/MyLocation';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const initialCenter = {
  lat: -25.5469,  // Latitude of Foz do Iguaçu, Brazil
  lng: -54.5882   // Longitude of Foz do Iguaçu, Brazil
};

// Use the API key from the .env file
const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const Mapa = () => {
  const [zoom, setZoom] = useState(14);
  const [center, setCenter] = useState(initialCenter);
  const mapRef = useRef(null);

  const [addresses, setAddresses] = useState(['', '', '']); // Three default empty addresses
  const [directions, setDirections] = useState(null);
  const [waypointsMarkers, setWaypointsMarkers] = useState([]);
  const [totalDistance, setTotalDistance] = useState(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Function to use current location
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

  const handleOptimizeRoute = () => {
    const addressesArray = addresses.filter(address => address.trim() !== '');

    if (addressesArray.length < 2) {
      alert('Por favor, insira pelo menos dois endereços.');
      return;
    }

    const origin = addressesArray[0];
    const waypoints = addressesArray.slice(1, -1);

    const distanceMatrixService = new window.google.maps.DistanceMatrixService();

    distanceMatrixService.getDistanceMatrix(
      {
        origins: addressesArray,
        destinations: addressesArray,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === 'OK') {
          try {
            const distanceData = response.rows;

            if (!distanceData || distanceData.length === 0 || !distanceData[0].elements) {
              throw new Error("Incomplete response from Distance Matrix API");
            }

            const optimizedOrder = getOptimalOrder(distanceData);
            const reorderedWaypoints = optimizedOrder.slice(1).map(index => ({
              location: addressesArray[index],
            }));

            const directionsService = new window.google.maps.DirectionsService();
            directionsService.route(
              {
                origin: addressesArray[optimizedOrder[0]],
                destination: addressesArray[optimizedOrder[optimizedOrder.length - 1]],
                waypoints: reorderedWaypoints,
                travelMode: window.google.maps.TravelMode.DRIVING
              },
              (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK) {
                  setDirections(result);

                  const markers = [];

                  markers.push({
                    location: result.routes[0].legs[0].start_location,
                    label: {
                      text: '1',
                      color: 'white',
                      fontWeight: 'bold'
                    },
                    key: 'wp-origin'
                  });

                  result.routes[0].legs.slice(0, -1).forEach((leg, i) => {
                    markers.push({
                      location: leg.end_location,
                      label: {
                        text: (i + 2).toString(),
                        color: 'white',
                        fontWeight: 'bold'
                      },
                      key: `wp-${i}`
                    });
                  });

                  setWaypointsMarkers(markers);

                  let totalDistance = 0;
                  result.routes[0].legs.forEach(leg => {
                    totalDistance += leg.distance.value;
                  });
                  totalDistance /= 1000; // Convert to km
                  setTotalDistance(totalDistance);

                  // Construct Google Maps URL
                  const destination = addressesArray[optimizedOrder[optimizedOrder.length - 1]];
                  const waypointsForUrl = optimizedOrder.slice(1, -1).map(index => addressesArray[index]).join('|');
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypointsForUrl)}`;

                  setGoogleMapsUrl(googleMapsUrl);
                } else {
                  console.error(`Error fetching directions: ${status}`);
                  alert('Houve um erro ao obter a rota. Por favor, tente novamente.');
                }
              }
            );
          } catch (error) {
            console.error('Error processing Distance Matrix response:', error);
            alert('Um ou mais dos endereços possui pouca informação. Adicione, por exemplo, a cidade, nome da rua ou número.');
          }
        } else {
          console.error(`Distance Matrix request failed: ${status}`);
          alert('Falha ao calcular as distâncias. Verifique se todos os endereços estão corretos.');
        }
      }
    );
  };

  const getOptimalOrder = (distanceData) => {
    const n = distanceData.length;
    const visited = new Array(n).fill(false);
    const order = [];
    let currentIndex = 0;
    visited[0] = true;
    order.push(0);

    for (let i = 1; i < n; i++) {
      let nextIndex = -1;
      let minDistance = Number.MAX_SAFE_INTEGER;

      for (let j = 0; j < n; j++) {
        if (!visited[j] && distanceData[currentIndex].elements[j].distance.value < minDistance) {
          minDistance = distanceData[currentIndex].elements[j].distance.value;
          nextIndex = j;
        }
      }

      visited[nextIndex] = true;
      order.push(nextIndex);
      currentIndex = nextIndex;
    }

    return order;
  };

  const handleAddressChange = (index, value) => {
    const updatedAddresses = [...addresses];
    updatedAddresses[index] = value;
    setAddresses(updatedAddresses);
  };

  const handleAddAddress = () => {
    setAddresses([...addresses, '']);
  };

  return (
    <div className="flex flex-col md:flex-row md:h-[85vh] md:ml-[25%]">
      <div className="md:w-1/2 p-4 ">
        <div className="bg-gray-800 h-[400px] md:h-full">
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
        <div className='mb-8'>
        {googleMapsUrl && (
          <button
            className="bg-blue-500 text-white p-3 rounded-lg shadow-lg hover:bg-blue-600 mt-4"
            onClick={() => window.open(googleMapsUrl, '_blank')}
          >
            Abrir Rota no Maps
          </button>
        )}</div>
        <div className='flex flex-column gap-8 justify-center'>
          
          <button
            className="bg-green-500 text-white p-3 rounded-lg shadow-lg hover:bg-green-600"
            onClick={handleAddAddress}
          >
            + Adicionar
          </button>
          <button
            className="bg-blue-500 text-white p-3 rounded-lg shadow-lg hover:bg-blue-600"
            onClick={handleOptimizeRoute}
          >
            Obter Rota
          </button>
        </div>
        {totalDistance && (
          <div className="mt-2 text-black font-bold">
            Distância total: {totalDistance.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  );
}

export default Mapa;
