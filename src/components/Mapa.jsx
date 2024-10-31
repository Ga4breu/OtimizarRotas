import React, { useState, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker } from '@react-google-maps/api';
import MyLocationIcon from '@mui/icons-material/MyLocation';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const initialCenter = {
  lat: -25.5469,  // Latitude de Foz do Iguaçu, Brasil
  lng: -54.5882   // Longitude de Foz do Iguaçu, Brasil
};

// Defina o array libraries fora do componente
const libraries = ['places'];

// Use a API Key do arquivo .env
const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const Mapa = () => {
  const [zoom, setZoom] = useState(14);
  const [center, setCenter] = useState(initialCenter);
  const mapRef = useRef(null);

  const [addresses, setAddresses] = useState(['', '', '']); // Três endereços vazios por padrão
  const [directions, setDirections] = useState(null);
  const [waypointsMarkers, setWaypointsMarkers] = useState([]);
  const [totalDistance, setTotalDistance] = useState(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');

  // Carrega o script do Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Função para usar a localização atual
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
        console.error('Erro ao obter a localização:', error);
        alert('Não foi possível obter sua localização atual.');
      });
    } else {
      alert('Geolocalização não é suportada pelo seu navegador.');
    }
  };

  // Limite de chamadas à API
  const [apiCallCount, setApiCallCount] = useState(0);
  const [lastApiCallTimestamp, setLastApiCallTimestamp] = useState(0);

  const MAX_API_CALLS = 3;
  const RATE_LIMIT_INTERVAL = 60000; // 60 segundos

  const canMakeApiCall = () => {
    const currentTime = Date.now();
    if (currentTime - lastApiCallTimestamp > RATE_LIMIT_INTERVAL) {
      setApiCallCount(1);
      setLastApiCallTimestamp(currentTime);
      return true;
    } else if (apiCallCount < MAX_API_CALLS) {
      setApiCallCount(apiCallCount + 1);
      return true;
    }
    return false;
  };

  const handleOptimizeRoute = () => {
    const addressesArray = addresses.filter(address => address.trim() !== '');

    if (!canMakeApiCall()) {
      alert(`Cansou minha API, pode rodar dnv em 60 segundos.`);
      return;
    }
    if (addressesArray.length < 2) {
      alert('Por favor, insira pelo menos dois endereços.');
      return;
    }

    const origin = addressesArray[0];

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
              throw new Error("Resposta incompleta da API Distance Matrix");
            }

            const optimizedOrder = getOptimalOrder(distanceData);

            // Reordenar addressesArray de acordo com optimizedOrder
            const reorderedAddresses = optimizedOrder.map(index => addressesArray[index]);

            // Preparar waypoints para DirectionsService
            const waypoints = reorderedAddresses.slice(1, -1).map(location => ({
              location: location,
            }));

            const directionsService = new window.google.maps.DirectionsService();
            directionsService.route(
              {
                origin: reorderedAddresses[0],
                destination: reorderedAddresses[reorderedAddresses.length - 1],
                waypoints: waypoints,
                travelMode: window.google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false, // Já otimizamos a rota
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

                  result.routes[0].legs.forEach((leg, i) => {
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
                  totalDistance /= 1000; // Converter para km
                  setTotalDistance(totalDistance);

                  // Construir URL do Google Maps
                  const destination = reorderedAddresses[reorderedAddresses.length - 1];
                  const waypointsForUrl = reorderedAddresses.slice(1, -1).join('|');
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(reorderedAddresses[0])}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypointsForUrl)}`;

                  setGoogleMapsUrl(googleMapsUrl);
                } else {
                  console.error(`Erro ao obter direções: ${status}`);
                  alert('Houve um erro ao obter a rota. Por favor, tente novamente.');
                }
              }
            );
          } catch (error) {
            console.error('Erro ao processar a resposta da Distance Matrix:', error);
            alert('Um ou mais dos endereços possui pouca informação. Adicione, por exemplo, a cidade, nome da rua ou número.');
          }
        } else {
          console.error(`Falha na solicitação Distance Matrix: ${status}`);
          alert('Falha ao calcular as distâncias. Verifique se todos os endereços estão corretos.');
        }
      }
    );
  };

  const getOptimalOrder = (distanceData) => {
    const n = distanceData.length;

    if (n <= 10) {
      // Algoritmo de força bruta para TSP
      const indices = [];
      for (let i = 1; i < n; i++) {
        indices.push(i);
      }

      let minDistance = Number.MAX_SAFE_INTEGER;
      let bestOrder = null;

      const permute = (arr, l, r) => {
        if (l === r) {
          // Calcular a distância total para esta permutação
          let totalDistance = 0;
          let prevIndex = 0; // Começa da origem (índice 0)
          for (let i = 0; i < arr.length; i++) {
            const currentIndex = arr[i];
            totalDistance += distanceData[prevIndex].elements[currentIndex].distance.value;
            prevIndex = currentIndex;
          }

          if (totalDistance < minDistance) {
            minDistance = totalDistance;
            bestOrder = [0].concat(arr.slice());
          }
        } else {
          for (let i = l; i <= r; i++) {
            [arr[l], arr[i]] = [arr[i], arr[l]]; // Swap
            permute(arr, l + 1, r);
            [arr[l], arr[i]] = [arr[i], arr[l]]; // Backtrack
          }
        }
      };

      permute(indices, 0, indices.length - 1);

      return bestOrder;
    } else {
      // Usa o algoritmo do vizinho mais próximo
      const visited = new Array(n).fill(false);
      const order = [];
      let currentIndex = 0;
      visited[0] = true;
      order.push(0);

      for (let i = 1; i < n; i++) {
        let nextIndex = -1;
        let minDistance = Number.MAX_SAFE_INTEGER;

        for (let j = 0; j < n; j++) {
          if (
            !visited[j] &&
            distanceData[currentIndex].elements[j].distance.value < minDistance
          ) {
            minDistance = distanceData[currentIndex].elements[j].distance.value;
            nextIndex = j;
          }
        }

        visited[nextIndex] = true;
        order.push(nextIndex);
        currentIndex = nextIndex;
      }

      return order;
    }
  };

  const handleAddressChange = (index, value) => {
    const updatedAddresses = [...addresses];
    updatedAddresses[index] = value;
    setAddresses(updatedAddresses);
  };

  const handleAddAddress = () => {
    setAddresses([...addresses, '']);
  };

  if (loadError) {
    return <div>Erro ao carregar o Google Maps API</div>;
  }

  return (
    <div className="flex flex-col md:flex-row md:min-h-[75vh] p-2 gap-8 mt-4 z-20 overflow-visible">
      <div className="items-center">
        <div className="bg-gray-800 h-[40vh] md:w-[30vw] md:h-[80%] border-4 rounded-lg border-black">
          {isLoaded ? (
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
          ) : (
            <div>Carregando...</div>
          )}
        </div>
        <div className='mb-8'>
          {googleMapsUrl && (
            <button
              className="bg-blue-500 text-white p-3 rounded-lg shadow-lg hover:bg-blue-600 mt-4"
              onClick={() => window.open(googleMapsUrl, '_blank')}
            >
              Abrir Rota no Maps
            </button>
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
              className="w-64 p-2 border-2 rounded-lg"
            />
            {index === 0 && (
              <button
                className="bg-green-500 text-white ml-2 p-2 rounded-lg hover:bg-green-600"
                onClick={handleUseCurrentLocation}
              >
                <MyLocationIcon />
              </button>
            )}
          </div>
        ))}
        <div className='flex flex-column gap-8 '>
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
};

export default Mapa;
