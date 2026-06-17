import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import {
  Bell,
  CarFront,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Gauge,
  Headphones,
  Heart,
  Home,
  MapPin,
  Menu,
  MessageCircle,
  Navigation2,
  RadioTower,
  ShieldCheck,
  Star,
  UserRound,
  WalletCards,
} from 'lucide-react';
import './styles.css';

const rideOptions = [
  { name: 'SIGA Pop', time: '4 min', ratePerKm: 2.4, note: 'economico' },
  { name: 'SIGA Comfort', time: '2 min', ratePerKm: 3.1, note: 'recomendado' },
  { name: 'SIGA Black', time: '6 min', ratePerKm: 4.6, note: 'premium' },
];

const paymentOptions = ['Pix', 'Cartao de credito', 'Carteira SIGA', 'Dinheiro'];

const driverStats = [
  { label: 'Hoje', value: 'R$ 186', icon: CircleDollarSign },
  { label: 'Aceite', value: '92%', icon: Gauge },
  { label: 'Zona quente', value: '2.4x', icon: RadioTower },
];

const rideLabels = {
  idle: 'Sem pedido ativo',
  requested: 'Pedido enviado',
  accepted: 'Motorista aceitou',
  arrived: 'Motorista chegou',
  started: 'Corrida em andamento',
  completed: 'Corrida finalizada',
  cancelled: 'Corrida cancelada',
};

const initialRide = {
  status: 'idle',
  category: null,
  price: null,
  origin: 'Av. Paulista, 1578',
  destination: 'Congonhas',
  paymentMethod: null,
  distanceKm: null,
  durationMin: null,
  pickupDistanceKm: null,
  billableKm: null,
  ratePerKm: null,
  originCoords: null,
  destinationCoords: null,
  driver: null,
  vehicle: null,
};

const fallbackLocations = [
  { key: 'paulista', coords: [-23.5614, -46.6559] },
  { key: 'augusta', coords: [-23.5539, -46.6538] },
  { key: 'congonhas', coords: [-23.6261, -46.6566] },
  { key: 'morumbi', coords: [-23.6229, -46.6997] },
  { key: 'pinheiros', coords: [-23.5674, -46.7019] },
  { key: 'vila olimpia', coords: [-23.5953, -46.6858] },
  { key: 'itaim', coords: [-23.5849, -46.6778] },
  { key: 'centro', coords: [-23.5505, -46.6333] },
];

const simulatedDrivers = [
  { id: 'M1', name: 'Marina Prado', coords: [-23.5728, -46.6657] },
  { id: 'M2', name: 'Lucas Santos', coords: [-23.5922, -46.6904] },
  { id: 'M3', name: 'Rafa Almeida', coords: [-23.5342, -46.6428] },
  { id: 'M4', name: 'Ana Costa', coords: [-23.615, -46.6518] },
];

let googleMapsLoaderPromise = null;

async function loadGoogleMaps() {
  if (window.google?.maps) return window.google.maps;
  if (googleMapsLoaderPromise) return googleMapsLoaderPromise;

  googleMapsLoaderPromise = fetch('/api/config')
    .then((response) => response.json())
    .then((config) => {
      if (!config.googleMapsApiKey) {
        throw new Error('missing-key');
      }

      return new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-siga-google-maps]');
        if (existingScript) {
          if (window.google?.maps) {
            resolve(window.google.maps);
            return;
          }
          existingScript.remove();
        }

        const callbackName = '__sigaGoogleMapsReady';
        const timeout = window.setTimeout(() => reject(new Error('load-timeout')), 12000);
        window[callbackName] = () => {
          window.clearTimeout(timeout);
          if (window.google?.maps) {
            resolve(window.google.maps);
            return;
          }
          reject(new Error('load-failed'));
        };
        window.gm_authFailure = () => {
          window.clearTimeout(timeout);
          reject(new Error('auth-failed'));
        };

        const script = document.createElement('script');
        script.dataset.sigaGoogleMaps = 'true';
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&libraries=places,geometry&v=weekly&loading=async&callback=${callbackName}`;
        script.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error('load-failed'));
        };
        document.head.appendChild(script);
      });
    });

  return googleMapsLoaderPromise;
}

function distanceBetweenKm(a, b) {
  if (!a || !b) return 0;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function findFarthestDriverWithinRadius(originCoords, radiusKm = 5) {
  const fixedCandidates = simulatedDrivers
    .map((driver) => ({ ...driver, distanceKm: distanceBetweenKm(originCoords, driver.coords) }))
    .filter((driver) => driver.distanceKm <= radiusKm)
    .sort((a, b) => b.distanceKm - a.distanceKm);
  if (fixedCandidates[0]) return fixedCandidates[0];

  if (!originCoords) return null;

  const simulatedNearbyDrivers = [
    { id: 'S1', name: 'Lucas Santos', kmNorth: 2.4, kmEast: 1.8 },
    { id: 'S2', name: 'Marina Prado', kmNorth: -3.1, kmEast: 2.7 },
    { id: 'S3', name: 'Ana Costa', kmNorth: 4.2, kmEast: -1.9 },
  ].map((driver) => {
    const latOffset = driver.kmNorth / 111;
    const lngOffset = driver.kmEast / (111 * Math.cos((originCoords[0] * Math.PI) / 180));
    const coords = [originCoords[0] + latOffset, originCoords[1] + lngOffset];
    return { ...driver, coords, distanceKm: distanceBetweenKm(originCoords, coords) };
  });

  return simulatedNearbyDrivers
    .filter((driver) => driver.distanceKm <= radiusKm)
    .sort((a, b) => b.distanceKm - a.distanceKm)[0] || null;
}

function fallbackCoords(address, offset = 0) {
  const normalized = address.toLowerCase();
  const found = fallbackLocations.find((item) => normalized.includes(item.key));
  if (found) return found.coords;
  return [-23.5614 + offset * 0.035, -46.6559 - offset * 0.04];
}

async function geocodeAddress(address, offset) {
  const query = address.trim();
  if (!query) return null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('q', `${query}, Sao Paulo, Brasil`);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const [result] = await response.json();
    if (result?.lat && result?.lon) return [Number(result.lat), Number(result.lon)];
  } catch {
    // Fallback keeps the route visible if geocoding is unavailable.
  }

  return fallbackCoords(query, offset);
}

function estimateRoute(origin, destination, ride) {
  const cleanOrigin = origin.trim();
  const cleanDestination = destination.trim();
  if (!cleanOrigin || !cleanDestination) {
    return {
      isReady: false,
      distanceKm: 0,
      durationMin: 0,
      pickupDistanceKm: 0,
      billableKm: 0,
      ratePerKm: ride.ratePerKm,
      priceNumber: 0,
      price: 'R$ 0,00',
    };
  }

  const seed = `${cleanOrigin}|${cleanDestination}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const distanceKm = Math.max(2.4, Math.min(32, 3.2 + (seed % 220) / 10));
  const pickupDistanceKm = Math.min(5, Math.max(1.2, 2.6 + (seed % 25) / 10));
  const billableKm = distanceKm + pickupDistanceKm;
  const durationMin = Math.round(distanceKm * 2.4 + pickupDistanceKm * 2.1 + 6);
  const priceNumber = billableKm * ride.ratePerKm;
  return {
    isReady: true,
    distanceKm: distanceKm.toFixed(1),
    pickupDistanceKm: pickupDistanceKm.toFixed(1),
    billableKm: billableKm.toFixed(1),
    ratePerKm: ride.ratePerKm,
    durationMin,
    priceNumber,
    price: priceNumber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  };
}

function estimateRouteWithDriver(origin, destination, ride, routePreview) {
  const base = estimateRoute(origin, destination, ride);
  const routeDistanceKm = Number(routePreview?.routeDistanceKm);
  const routeDurationMin = Number(routePreview?.routeDurationMin);
  const routeBase = routeDistanceKm > 0
    ? {
        ...base,
        isReady: true,
        distanceKm: routeDistanceKm.toFixed(1),
        durationMin: Math.max(1, Math.round(routeDurationMin || routeDistanceKm * 2.4 + 6)),
      }
    : base;
  const originCoords = routePreview?.originCoords || fallbackCoords(origin, 0);
  const selectedDriver = routeBase.isReady ? findFarthestDriverWithinRadius(originCoords, 5) : null;

  if (!routeBase.isReady) {
    return { ...routeBase, hasDriver: false, driver: null, price: 'Informe rota' };
  }

  if (!selectedDriver) {
    return {
      ...routeBase,
      hasDriver: false,
      driver: null,
      pickupDistanceKm: 0,
      billableKm: Number(routeBase.distanceKm).toFixed(1),
      priceNumber: 0,
      price: 'Indisponivel',
    };
  }

  const pickupDistanceKm = selectedDriver.distanceKm;
  const billableKm = Number(routeBase.distanceKm) + pickupDistanceKm;
  const durationMin = Math.round(Number(routeBase.durationMin) + pickupDistanceKm * 2.1);
  const priceNumber = billableKm * ride.ratePerKm;

  return {
    ...routeBase,
    hasDriver: true,
    driver: selectedDriver,
    pickupDistanceKm: pickupDistanceKm.toFixed(1),
    billableKm: billableKm.toFixed(1),
    durationMin,
    priceNumber,
    price: priceNumber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  };
}

function App() {
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState('passenger');
  const [passengerStage, setPassengerStage] = useState('home');
  const [selectedRide, setSelectedRide] = useState(1);
  const [online, setOnline] = useState(true);
  const [origin, setOrigin] = useState('Seu local');
  const [destination, setDestination] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [routePreview, setRoutePreview] = useState(null);
  const [userLocationCoords, setUserLocationCoords] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [ride, setRide] = useState(initialRide);
  const activeRide = rideOptions[selectedRide];
  const isPassenger = mode === 'passenger';
  const estimate = useMemo(
    () => estimateRouteWithDriver(origin, destination, activeRide, {
      ...routePreview,
      originCoords: userLocationCoords || routePreview?.originCoords,
    }),
    [origin, destination, activeRide, routePreview, userLocationCoords],
  );
  const canRequestRide = estimate.isReady && estimate.hasDriver && paymentMethod;

  const cta = useMemo(() => {
    if (isPassenger) {
      if (ride.status === 'idle' || ride.status === 'cancelled' || ride.status === 'completed') {
        return canRequestRide ? `Chamar ${activeRide.name}` : 'Preencha a corrida';
      }
      if (ride.status === 'requested') return 'Aguardando motorista';
      if (ride.status === 'accepted') return 'Confirmar embarque';
      if (ride.status === 'arrived') return 'Motorista chegou';
      if (ride.status === 'started') return 'Em viagem';
    }
    if (ride.status === 'requested') return 'Aceitar corrida';
    if (ride.status === 'accepted') return 'Cheguei ao local';
    if (ride.status === 'arrived') return 'Iniciar corrida';
    if (ride.status === 'started') return 'Finalizar corrida';
    if (ride.status === 'completed' || ride.status === 'cancelled') return 'Limpar simulação';
    return online ? 'Receber corridas' : 'Ficar online';
  }, [activeRide, canRequestRide, isPassenger, online, ride.status]);

  useEffect(() => {
    const client = io();
    setSocket(client);
    client.on('connect', () => setConnected(true));
    client.on('disconnect', () => setConnected(false));
    client.on('ride:update', setRide);

    return () => {
      client.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setUserLocationCoords(coords);
        setOrigin((current) => current.trim() ? current : 'Seu local');
        setRoutePreview((current) => ({
          ...current,
          originCoords: coords,
        }));
      },
      () => {
        setOrigin((current) => current.trim() ? current : 'Seu local');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 120000,
        timeout: 8000,
      },
    );
  }, []);

  useEffect(() => {
    let alive = true;

    async function syncRide() {
      try {
        const response = await fetch('/api/ride', { cache: 'no-store' });
        if (!response.ok) return;
        const nextRide = await response.json();
        if (alive) setRide(nextRide);
      } catch {
        // Socket.IO remains the primary realtime channel; polling is only a fallback.
      }
    }

    syncRide();
    const interval = window.setInterval(syncRide, 2500);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  async function emitRide(event, payload) {
    try {
      const response = await fetch('/api/ride/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload }),
      });
      const result = await response.json();
      if (result.ride) setRide(result.ride);
    } catch {
      socket?.emit(event, payload);
      window.setTimeout(async () => {
        try {
          const response = await fetch('/api/ride', { cache: 'no-store' });
          if (response.ok) setRide(await response.json());
        } catch {
          // Keep the current UI state if the fallback request fails.
        }
      }, 400);
    }
  }

  function updateOrigin(nextOrigin) {
    setOrigin(nextOrigin);
    if (nextOrigin.trim().toLowerCase() !== 'seu local') {
      setUserLocationCoords(null);
      setRoutePreview((current) => current ? { ...current, originCoords: null } : current);
    }
  }

  function handleMainAction() {
    if (isPassenger) {
      if (ride.status === 'idle' || ride.status === 'cancelled' || ride.status === 'completed') {
        if (!canRequestRide) return;
        emitRide('ride:request', {
          category: activeRide.name,
          price: estimate.price,
          origin: origin.trim(),
          destination: destination.trim(),
          paymentMethod,
          distanceKm: estimate.distanceKm,
          durationMin: String(estimate.durationMin),
          pickupDistanceKm: estimate.pickupDistanceKm,
          billableKm: estimate.billableKm,
          ratePerKm: String(estimate.ratePerKm),
          assignedDriverName: estimate.driver?.name,
          assignedDriverDistanceKm: estimate.pickupDistanceKm,
          originCoords: userLocationCoords || routePreview?.originCoords || fallbackCoords(origin, 0),
          destinationCoords: routePreview?.destinationCoords || fallbackCoords(destination, 1),
        });
      }
      return;
    }

    if (!online) {
      setOnline(true);
      return;
    }

    const eventByStatus = {
      requested: 'ride:accept',
      accepted: 'ride:arrive',
      arrived: 'ride:start',
      started: 'ride:finish',
      completed: 'ride:reset',
      cancelled: 'ride:reset',
    };
    const event = eventByStatus[ride.status];
    if (event) emitRide(event);
  }

  if (!entered) {
    return (
      <main className="splash-page">
        <section className="splash-screen" aria-label="Entrada SIGA">
          <div className="splash-map">
            <span className="splash-street splash-street-a" />
            <span className="splash-street splash-street-b" />
            <span className="splash-street splash-street-c" />
            <span className="splash-route" />
          </div>
          <div className="splash-content">
            <p className="splash-kicker">Mobilidade urbana</p>
            <h1 className="siga-logo">SIGA</h1>
            <p className="splash-subtitle">Entre na sua jornada</p>
          </div>
          <div className="entry-actions" aria-label="Entrar no aplicativo">
            <button
              onClick={() => {
                setMode('passenger');
                setEntered(true);
              }}
            >
              <UserRound size={20} />
              Passageiro
            </button>
            <button
              onClick={() => {
                setMode('driver');
                setEntered(true);
              }}
            >
              <CarFront size={20} />
              Motorista
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!isPassenger) {
    return (
      <DriverMapExperience
        ride={ride}
        online={online}
        setOnline={setOnline}
        connected={connected}
        cta={cta}
        onMainAction={handleMainAction}
        emitRide={emitRide}
      />
    );
  }

  return (
    <PassengerAppExperience
      activeRide={activeRide}
      canRequestRide={canRequestRide}
      connected={connected}
      destination={destination}
      emitRide={emitRide}
      estimate={estimate}
      onMainAction={handleMainAction}
      origin={origin}
      passengerStage={passengerStage}
      paymentMethod={paymentMethod}
      ride={ride}
      routePreview={routePreview}
      selectedRide={selectedRide}
      setDestination={setDestination}
      setOrigin={updateOrigin}
      setPassengerStage={setPassengerStage}
      setPaymentMethod={setPaymentMethod}
      setRoutePreview={setRoutePreview}
      setSelectedRide={setSelectedRide}
      userLocationCoords={userLocationCoords}
    />
  );

  /*
  return (
    <main className="page">
      <section className="phone" aria-label="Aplicativo SIGA">
        <header className="app-topbar">
          <button className="round-button" aria-label="Abrir menu">
            <Menu size={21} />
          </button>
          <div className="brand">
            <span>S</span>
            <strong>SIGA</strong>
          </div>
          <button className="round-button" aria-label="Notificacoes">
            <Bell size={20} />
          </button>
        </header>

        <div className="environment-badge" aria-label="Ambiente ativo">
          {isPassenger ? <UserRound size={17} /> : <CarFront size={17} />}
          <div>
            <small>Ambiente ativo</small>
            <strong>{isPassenger ? 'Passageiro' : 'Motorista'}</strong>
          </div>
        </div>

        <section className="map-card">
          <RouteMap
            origin={isPassenger ? origin : ride.origin}
            destination={isPassenger ? destination : ride.destination}
            ride={ride}
            onRouteReady={setRoutePreview}
          />

          <div className="eta-pill">
            <small>{isPassenger ? 'Motorista chega em' : 'Proxima area forte'}</small>
            <strong>{isPassenger ? activeRide.time : '1.8 km'}</strong>
          </div>
        </section>

        <section className="sheet">
          {isPassenger ? (
            <PassengerView
              activeRide={activeRide}
              selectedRide={selectedRide}
              setSelectedRide={setSelectedRide}
              ride={ride}
              connected={connected}
              emitRide={emitRide}
              origin={origin}
              setOrigin={setOrigin}
              destination={destination}
              setDestination={setDestination}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              estimate={estimate}
              routePreview={routePreview}
            />
          ) : (
            <DriverView online={online} setOnline={setOnline} ride={ride} connected={connected} emitRide={emitRide} />
          )}
        </section>

        <footer className="bottom-bar">
          {isPassenger ? (
            <>
              <button className="active"><Home size={20} /><span>Inicio</span></button>
              <button><ShieldCheck size={20} /><span>Seguro</span></button>
              <button><CreditCard size={20} /><span>Carteira</span></button>
              <button><UserRound size={20} /><span>Perfil</span></button>
            </>
          ) : (
            <>
              <button className="active"><Home size={20} /><span>Painel</span></button>
              <button><RadioTower size={20} /><span>Demanda</span></button>
              <button><CircleDollarSign size={20} /><span>Ganhos</span></button>
              <button><UserRound size={20} /><span>Conta</span></button>
            </>
          )}
        </footer>

        <button className="main-cta" onClick={handleMainAction}>
          {cta}
          <ChevronRight size={20} />
        </button>
      </section>
    </main>
  );
  */
}

function PassengerView({
  activeRide,
  selectedRide,
  setSelectedRide,
  ride,
  connected,
  emitRide,
  origin,
  setOrigin,
  destination,
  setDestination,
  paymentMethod,
  setPaymentMethod,
  estimate,
  routePreview,
}) {
  const hasActiveRide = !['idle', 'completed', 'cancelled'].includes(ride.status);
  const passengerSteps = [
    { label: 'Origem', value: origin || 'Informe a origem', icon: MapPin },
    { label: 'Destino', value: destination || 'Informe o destino', icon: Navigation2 },
    { label: 'Pagamento', value: paymentMethod || 'Escolha o pagamento', icon: WalletCards },
  ];

  return (
    <>
      <div className="sheet-handle" />
      <RealtimeBanner connected={connected} ride={ride} />
      {hasActiveRide ? (
        <div className="destination-card">
          <div className="point-line">
            {passengerSteps.map((step) => (
              <div className="point-item" key={step.label}>
                <span><step.icon size={17} /></span>
                <div>
                  <small>{step.label}</small>
                  <strong>{step.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="booking-form">
          <label>
            <span>Origem</span>
            <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Ex: Av. Paulista, 1578" />
          </label>
          <label>
            <span>Destino</span>
            <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Ex: Shopping Morumbi" />
          </label>
          <label>
            <span>Pagamento</span>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="">Selecione</option>
              {paymentOptions.map((option) => (
                <option value={option} key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="section-title">
        <h1>{hasActiveRide ? rideLabels[ride.status] : 'Escolha sua corrida'}</h1>
        <span>{hasActiveRide ? ride.price : estimate.isReady ? estimate.price : activeRide.time}</span>
      </div>

      {hasActiveRide ? (
        <RideStatusCard ride={ride} emitRide={emitRide} role="passenger" />
      ) : (
        <div className="ride-list">
          {rideOptions.map((rideOption, index) => (
            <button
              className={selectedRide === index ? 'ride-row selected' : 'ride-row'}
              key={rideOption.name}
              onClick={() => setSelectedRide(index)}
            >
              <span className="ride-avatar"><CarFront size={21} /></span>
              <div>
              <strong>{rideOption.name}</strong>
              <small>{rideOption.time} de espera - {rideOption.note}</small>
            </div>
              <b>{estimateRouteWithDriver(origin, destination, rideOption, estimate.isReady ? { originCoords: routePreview?.originCoords } : null).price}</b>
            </button>
          ))}
        </div>
      )}

      {!hasActiveRide && estimate.isReady && (
        estimate.hasDriver ? (
          <div className="fare-summary">
            <span><Clock3 size={17} /> {estimate.durationMin} min</span>
            <span><Navigation2 size={17} /> {estimate.distanceKm} km percurso</span>
            <span><CarFront size={17} /> {estimate.pickupDistanceKm} km motorista</span>
            <span>{estimate.billableKm} km x R$ {estimate.ratePerKm.toFixed(2).replace('.', ',')}</span>
            <strong>{paymentMethod || 'Escolha o pagamento'}</strong>
          </div>
        ) : (
          <div className="availability-warning">
            <CarFront size={18} />
            <div>
              <strong>Nenhum motorista disponivel</strong>
              <small>Nao encontramos motorista em um raio de 5 km da origem informada.</small>
            </div>
          </div>
        )
      )}

      <article className="safety-card">
        <ShieldCheck size={22} />
        <div>
          <strong>Viagem protegida</strong>
          <p>Codigo de embarque, rota compartilhada, pagamento definido e suporte ativo durante toda a corrida.</p>
        </div>
      </article>
    </>
  );
}

const recentDestinations = [
  { name: 'Imperio dos Moveis', address: 'Avenida Desembargador Mario da Silva Nunes', km: '7.6 km' },
  { name: 'Rua Professora Elza Lemos Andreatta', address: 'Morada de Camburi, Vitoria - ES', km: '780 m' },
  { name: 'Shopping Mestre Alvaro', address: 'Av. Joao Palacio, 300 - Eurico Salles', km: '4.3 km' },
  { name: 'Aeroporto de Congonhas', address: 'Av. Washington Luis, Sao Paulo', km: '8.1 km' },
  { name: 'Academia Triton', address: 'Rua Arquimedes Thevenard, Jardim Camburi', km: '4.2 km' },
];

function PassengerAppExperience({
  activeRide,
  canRequestRide,
  connected,
  destination,
  estimate,
  onMainAction,
  origin,
  passengerStage,
  paymentMethod,
  ride,
  routePreview,
  selectedRide,
  setDestination,
  setOrigin,
  setPassengerStage,
  setPaymentMethod,
  setRoutePreview,
  setSelectedRide,
  userLocationCoords,
}) {
  const rideActive = !['idle', 'completed', 'cancelled'].includes(ride.status);
  const stage = rideActive ? 'requested' : passengerStage;
  const rideWithUserOrigin = userLocationCoords ? { ...ride, originCoords: userLocationCoords } : ride;

  if (stage === 'plan') {
    return (
      <main className="passenger-dark-page">
        <section className="passenger-screen">
          <header className="passenger-plan-header">
            <button onClick={() => setPassengerStage('home')}><ChevronRight size={21} /></button>
            <h1>Planeje sua proxima viagem</h1>
          </header>

          <div className="plan-chips">
            <span><Clock3 size={15} /> Ir agora</span>
            <span><UserRound size={15} /> Para mim</span>
          </div>

          <div className="plan-card">
            <label>
              <span>Origem</span>
              <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Seu local" />
            </label>
            <label>
              <span>Destino</span>
              <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Para onde?" />
            </label>
          </div>

          <div className="recent-list">
            {recentDestinations.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  setDestination(item.name);
                  setPassengerStage('choose');
                }}
              >
                <Clock3 size={17} />
                <small>{item.km}</small>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.address}</span>
                </div>
              </button>
            ))}
          </div>

          <button className="continue-plan" onClick={() => setPassengerStage('choose')} disabled={!destination.trim()}>
            Continuar
          </button>
        </section>
      </main>
    );
  }

  if (stage === 'choose') {
    return (
      <main className="passenger-dark-page">
        <section className="passenger-screen">
          <div className="passenger-map-large">
            <RouteMap origin={origin} destination={destination} ride={rideWithUserOrigin} onRouteReady={setRoutePreview} />
            <button className="map-back" onClick={() => setPassengerStage('plan')}><ChevronRight size={22} /></button>
            <div className="route-title">{origin.split(',')[0] || 'Origem'} <span>›</span> {destination || 'Destino'}</div>
          </div>

          <section className="ride-choice-sheet">
            <div className="sheet-handle" />
            <h1>Escolher uma viagem</h1>
            <div className="ride-choice-list">
              {rideOptions.map((rideOption, index) => {
                const optionEstimate = estimateRouteWithDriver(origin, destination, rideOption, {
                  ...routePreview,
                  originCoords: userLocationCoords || routePreview?.originCoords,
                });
                return (
                  <button
                    className={selectedRide === index ? 'choice-row selected' : 'choice-row'}
                    onClick={() => setSelectedRide(index)}
                    key={rideOption.name}
                  >
                    <span><CarFront size={26} /></span>
                    <div>
                      <strong>{rideOption.name}</strong>
                      <small>{rideOption.time} espera · {optionEstimate.durationMin || '--'} min</small>
                    </div>
                    <b>{optionEstimate.price}</b>
                  </button>
                );
              })}
            </div>

            <label className="payment-row">
              <WalletCards size={22} />
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="">Pagamento</option>
                {paymentOptions.map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>

            {estimate.isReady && (
              estimate.hasDriver ? (
                <div className="passenger-price-rule">
                  {estimate.distanceKm} km percurso + {estimate.pickupDistanceKm} km motorista = {estimate.billableKm} km cobrados
                </div>
              ) : (
                <div className="passenger-unavailable">Nenhum motorista disponivel em ate 5 km da origem.</div>
              )
            )}

            <button className="choose-ride-button" onClick={onMainAction} disabled={!canRequestRide}>
              {canRequestRide ? `Escolher ${activeRide.name}` : 'Complete a viagem'}
            </button>
          </section>
        </section>
      </main>
    );
  }

  if (stage === 'requested') {
    return (
      <main className="passenger-dark-page">
        <section className="passenger-screen">
          <div className="requested-map">
            <RouteMap origin={ride.origin} destination={ride.destination} ride={ride} />
            <button className="map-back"><ChevronRight size={22} /></button>
          </div>
          <section className="requested-sheet">
            <div className="sheet-handle" />
            <h1>{rideLabels[ride.status]}</h1>
            <p>{ride.status === 'requested' ? 'Procurando um motorista parceiro perto de voce' : 'Acompanhe sua viagem em tempo real'}</p>
            <div className="request-progress" />
            <RideStatusCard ride={ride} emitRide={emitRide} role="passenger" />
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="passenger-dark-page">
      <section className="passenger-screen home-screen">
        <div className="passenger-tabs">
          <strong>🚘 SIGA</strong>
          <span>🛍 Envios</span>
        </div>

        <button className="where-card" onClick={() => setPassengerStage('plan')}>
          <MapPin size={22} />
          <span>Para onde?</span>
          <b>Mais tarde</b>
        </button>

        <button className="saved-place" onClick={() => {
          setDestination('Imperio dos Moveis');
          setPassengerStage('choose');
        }}>
          <Clock3 size={19} />
          <div>
            <strong>Imperio dos Moveis</strong>
            <span>Avenida Desembargador Mario ...</span>
          </div>
          <ChevronRight size={18} />
        </button>

        <h2>Para voce</h2>
        <div className="service-row">
          <button><CarFront size={30} /><span>Viagem</span></button>
          <button><Navigation2 size={30} /><span>Moto</span></button>
          <button><WalletCards size={30} /><span>Entrega</span></button>
          <button><Clock3 size={30} /><span>Reserve</span></button>
        </div>

        <h2>Economize todos os dias</h2>
        <div className="promo-row">
          <article>
            <div className="promo-map-art"><span /><b /></div>
            <strong>Adicione ate 5 paradas</strong>
            <small>Aproveite para retirar algo no caminho</small>
          </article>
          <article>
            <div className="promo-red-art" />
            <strong>Viagens com SIGA</strong>
            <small>Tarifa calculada com motorista no raio</small>
          </article>
        </div>

        <footer className="passenger-bottom-nav">
          <button className="active"><Home size={19} />Inicio</button>
          <button><Menu size={19} />Opcoes</button>
          <button><CreditCard size={19} />Atividade</button>
          <button><UserRound size={19} />Conta</button>
        </footer>
      </section>
    </main>
  );
}

function DriverView({ online, setOnline, ride, connected, emitRide }) {
  const hasRequest = ride.status !== 'idle';

  return (
    <>
      <div className="sheet-handle" />
      <RealtimeBanner connected={connected} ride={ride} />
      <div className="driver-status">
        <div>
          <small>Status do motorista</small>
          <strong>{online ? 'Online e recebendo chamadas' : 'Pausado'}</strong>
        </div>
        <button onClick={() => setOnline(!online)}>{online ? 'Pausar' : 'Ativar'}</button>
      </div>

      <div className="driver-grid">
        {driverStats.map((stat) => (
          <article key={stat.label}>
            <stat.icon size={20} />
            <small>{stat.label}</small>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      <div className="section-title">
        <h1>{hasRequest ? rideLabels[ride.status] : 'Aguardando pedido'}</h1>
        <span>{hasRequest ? ride.price : 'Online'}</span>
      </div>

      {hasRequest ? (
        <RideStatusCard ride={ride} emitRide={emitRide} role="driver" />
      ) : (
        <article className="trip-card empty-trip">
          <RadioTower size={26} />
          <strong>Abra esta tela em outro celular como passageiro e toque em chamar corrida.</strong>
          <small>A chamada aparece aqui automaticamente para aceitar.</small>
        </article>
      )}

      <div className="quality-list">
        <Quality icon={Star} label="Nota" value="4.98" />
        <Quality icon={MessageCircle} label="Resposta" value="11s" />
        <Quality icon={Headphones} label="Suporte" value="Ativo" />
        <Quality icon={Heart} label="Favoritos" value="24" />
      </div>
    </>
  );
}

function DriverMapExperience({ ride, online, setOnline, connected, cta, onMainAction, emitRide }) {
  const hasRequest = ride.status !== 'idle';
  const nextTrip = hasRequest ? `${ride.price || 'R$ 0,00'}` : '+R$ 5,50';

  return (
    <main className="driver-map-page">
      <section className="driver-map-screen" aria-label="Mapa do motorista SIGA">
        <DriverDemandMap ride={ride} />

        <div className="driver-map-top">
          <button className="driver-floating-button" aria-label="Inicio"><Home size={22} /></button>
          <div className="driver-earnings-pill">
            <span>R$</span>
            <strong>{hasRequest ? ride.price?.replace('R$', '').trim() : '64,33'}</strong>
          </div>
          <button className="driver-floating-button" aria-label="Buscar"><Menu size={22} /></button>
        </div>

        <div className="driver-today-chip">HOJE</div>

        <button className="driver-start-button" onClick={onMainAction}>{cta}</button>

        <div className="driver-map-side-actions">
          <button><ShieldCheck size={22} /></button>
          <button><Gauge size={22} /></button>
        </div>

        <div className="driver-map-bottom">
          <button className="driver-bar-icon" aria-label="Filtros"><Menu size={22} /></button>
          <div>
            <strong>{hasRequest ? `${rideLabels[ride.status]}: ${nextTrip}` : `Proxima viagem: ${nextTrip}`}</strong>
            <small>{connected ? (online ? 'Voce esta online' : 'Voce esta offline') : 'Conectando simulacao'}</small>
          </div>
          <button className="driver-bar-icon" onClick={() => setOnline(!online)} aria-label="Alternar status">
            <RadioTower size={22} />
          </button>
        </div>

        {hasRequest && (
          <div className="driver-request-sheet">
            <RideStatusCard ride={ride} emitRide={emitRide} role="driver" />
          </div>
        )}
      </section>
    </main>
  );
}

function DriverDemandMap({ ride }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const directionsRef = useRef(null);
  const markersRef = useRef([]);
  const [mapState, setMapState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    const hasTrip = ride.status !== 'idle';
    const originCoords = ride.originCoords || fallbackCoords(ride.origin || initialRide.origin, 0);
    const destinationCoords = ride.destinationCoords || fallbackCoords(ride.destination || initialRide.destination, 1);
    const driverCoords = ride.assignedDriverName
      ? simulatedDrivers.find((driver) => driver.name === ride.assignedDriverName)?.coords || simulatedDrivers[0].coords
      : simulatedDrivers[0].coords;

    async function drawDriverMap() {
      if (!mapNodeRef.current) return;

      try {
        setMapState('loading');
        const maps = await loadGoogleMaps();
        if (cancelled || !mapNodeRef.current) return;

        const toLatLng = (coords) => ({ lat: coords[0], lng: coords[1] });
        const originLatLng = toLatLng(originCoords);
        const destinationLatLng = toLatLng(destinationCoords);
        const driverLatLng = toLatLng(driverCoords);

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapNodeRef.current, {
            center: hasTrip ? originLatLng : driverLatLng,
            zoom: hasTrip ? 13 : 12,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: 'greedy',
            styles: [
              { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
              { featureType: 'road', elementType: 'geometry', stylers: [{ saturation: -18 }] },
              { featureType: 'water', stylers: [{ color: '#b8dcf4' }] },
            ],
          });
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        if (!directionsRef.current) {
          directionsRef.current = new maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#e5092d',
              strokeOpacity: 0.96,
              strokeWeight: 6,
            },
          });
        }

        const makeMarker = (position, label, title, color) => {
          const marker = new maps.Marker({
            position,
            map: mapRef.current,
            title,
            label: { text: label, color: '#ffffff', fontWeight: '900' },
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 15,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 4,
            },
          });
          markersRef.current.push(marker);
        };

        makeMarker(driverLatLng, 'M', ride.assignedDriverName || 'Motorista SIGA', '#111111');

        if (!hasTrip) {
          directionsRef.current.set('directions', null);
          mapRef.current.setCenter(driverLatLng);
          mapRef.current.setZoom(12);
          setMapState('ready');
          return;
        }

        makeMarker(originLatLng, 'A', ride.origin || 'Origem', '#e5092d');
        makeMarker(destinationLatLng, 'B', ride.destination || 'Destino', '#191114');

        const directionsService = new maps.DirectionsService();
        directionsService.route(
          {
            origin: originLatLng,
            destination: destinationLatLng,
            travelMode: maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (cancelled) return;

            if (status === 'OK' && result) {
              directionsRef.current.setDirections(result);
              setMapState('ready');
              return;
            }

            const bounds = new maps.LatLngBounds();
            bounds.extend(originLatLng);
            bounds.extend(destinationLatLng);
            bounds.extend(driverLatLng);
            mapRef.current.fitBounds(bounds, 72);
            setMapState('ready');
          },
        );
      } catch {
        if (!cancelled) setMapState('fallback');
      }
    }

    drawDriverMap();

    return () => {
      cancelled = true;
    };
  }, [
    ride.status,
    ride.origin,
    ride.destination,
    ride.originCoords,
    ride.destinationCoords,
    ride.assignedDriverName,
  ]);

  return (
    <div className="driver-demand-map">
      <div className="driver-google-map" ref={mapNodeRef} />
      {mapState === 'loading' && <div className="driver-map-message">Carregando ruas reais...</div>}
      {mapState === 'fallback' && (
        <div className="driver-map-message warning">Nao foi possivel carregar o Google Maps agora.</div>
      )}
      <span className="heat heat-one" />
      <span className="heat heat-two" />
      <span className="heat heat-three" />
      <span className="heat heat-four" />
      <span className="bonus bonus-one">+R$ 14,75</span>
      <span className="bonus bonus-two">+R$ 7,75</span>
      <span className="bonus bonus-three">+R$ 9,50</span>
      <span className="bonus bonus-four">+R$ 20</span>
      <span className="bonus bonus-five">+R$ 2</span>
    </div>
  );
}

function RealtimeBanner({ connected, ride }) {
  return (
    <div className={connected ? 'realtime-banner online' : 'realtime-banner'}>
      <span />
      <div>
        <strong>{connected ? 'Simulacao em tempo real' : 'Conectando simulacao'}</strong>
        <small>{rideLabels[ride.status]}</small>
      </div>
    </div>
  );
}

function RideStatusCard({ ride, emitRide, role }) {
  const canPassengerCancel = role === 'passenger' && ['requested', 'accepted', 'arrived'].includes(ride.status);
  const canReset = ['completed', 'cancelled'].includes(ride.status);

  return (
    <article className="ride-status-card">
      <div className="ride-status-header">
        <span><CarFront size={20} /></span>
        <div>
          <strong>{ride.category || 'SIGA Comfort'}</strong>
          <small>{ride.id || 'Pedido em preparacao'}</small>
        </div>
        <b>{ride.price || 'R$ 31,40'}</b>
      </div>

      <div className="timeline">
        <Step active done label="Pedido" />
        <Step active={['accepted', 'arrived', 'started', 'completed'].includes(ride.status)} done={['accepted', 'arrived', 'started', 'completed'].includes(ride.status)} label="Aceite" />
        <Step active={['arrived', 'started', 'completed'].includes(ride.status)} done={['arrived', 'started', 'completed'].includes(ride.status)} label="Chegada" />
        <Step active={['started', 'completed'].includes(ride.status)} done={['started', 'completed'].includes(ride.status)} label="Viagem" />
      </div>

      <div className="driver-mini-card">
        <strong>{ride.driver || 'Aguardando motorista'}</strong>
        <small>{ride.vehicle || 'A chamada ja esta visivel para o motorista.'}</small>
      </div>

      <div className="ride-detail-grid">
        <div>
          <small>Origem</small>
          <strong>{ride.origin}</strong>
        </div>
        <div>
          <small>Destino</small>
          <strong>{ride.destination}</strong>
        </div>
        <div>
          <small>Percurso</small>
          <strong>{ride.distanceKm || '0'} km - {ride.durationMin || '0'} min</strong>
        </div>
        <div>
          <small>Motorista ate voce</small>
          <strong>{ride.pickupDistanceKm || '0'} km</strong>
        </div>
        <div>
          <small>Km cobrados</small>
          <strong>{ride.billableKm || ride.distanceKm || '0'} km x R$ {Number(ride.ratePerKm || 0).toFixed(2).replace('.', ',')}</strong>
        </div>
        <div>
          <small>Pagamento</small>
          <strong>{ride.paymentMethod || 'Nao informado'}</strong>
        </div>
      </div>

      <div className="ride-actions">
        {canPassengerCancel && <button onClick={() => emitRide('ride:cancel')}>Cancelar pedido</button>}
        {canReset && <button onClick={() => emitRide('ride:reset')}>Nova simulacao</button>}
      </div>
    </article>
  );
}

function Step({ active, done, label }) {
  return (
    <div className={active ? 'timeline-step active' : 'timeline-step'}>
      <span>{done ? <CheckCircle2 size={15} /> : null}</span>
      <small>{label}</small>
    </div>
  );
}

function Quality({ icon: Icon, label, value }) {
  return (
    <div className="quality">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RouteMap({ origin, destination, ride, onRouteReady }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const directionsRef = useRef(null);
  const [mapState, setMapState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    const activeOrigin = ride.originCoords || fallbackCoords(origin || '', 0);
    const activeDestination = ride.destinationCoords || fallbackCoords(destination || '', 1);

    onRouteReady?.({ originCoords: activeOrigin, destinationCoords: activeDestination });

    async function drawMap() {
      if (!mapNodeRef.current) return;

      try {
        setMapState('loading');
        const maps = await loadGoogleMaps();
        if (cancelled || !mapNodeRef.current) return;

        const geocoder = new maps.Geocoder();
        const geocode = (address, fallback) => new Promise((resolve) => {
          if (!address?.trim()) {
            resolve({ lat: fallback[0], lng: fallback[1] });
            return;
          }

          geocoder.geocode(
            {
              address: `${address}, Brasil`,
              componentRestrictions: { country: 'BR' },
            },
            (results, status) => {
              if (status === 'OK' && results?.[0]?.geometry?.location) {
                const location = results[0].geometry.location;
                resolve({ lat: location.lat(), lng: location.lng() });
                return;
              }
              resolve({ lat: fallback[0], lng: fallback[1] });
            },
          );
        });

        const originLatLng = ride.originCoords
          ? { lat: ride.originCoords[0], lng: ride.originCoords[1] }
          : await geocode(origin, activeOrigin);
        const destinationLatLng = ride.destinationCoords
          ? { lat: ride.destinationCoords[0], lng: ride.destinationCoords[1] }
          : await geocode(destination || origin, activeDestination);

        if (cancelled || !mapNodeRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapNodeRef.current, {
            center: originLatLng,
            zoom: destination?.trim() ? 13 : 15,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: 'greedy',
            styles: [
              { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
          });
        } else {
          mapRef.current.setCenter(originLatLng);
        }

        if (!directionsRef.current) {
          directionsRef.current = new maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: '#e5092d',
              strokeOpacity: 0.95,
              strokeWeight: 6,
            },
          });
        }

        if (!destination?.trim() && !ride.destinationCoords) {
          directionsRef.current.set('directions', null);
          new maps.Marker({ position: originLatLng, map: mapRef.current, title: 'Origem SIGA' });
          setMapState('ready');
          return;
        }

        const directionsService = new maps.DirectionsService();
        directionsService.route(
          {
            origin: originLatLng,
            destination: destinationLatLng,
            travelMode: maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (cancelled) return;

            if (status === 'OK' && result) {
              directionsRef.current.setDirections(result);
              const leg = result.routes?.[0]?.legs?.[0];
              onRouteReady?.({
                originCoords: [originLatLng.lat, originLatLng.lng],
                destinationCoords: [destinationLatLng.lat, destinationLatLng.lng],
                routeDistanceKm: leg?.distance?.value ? leg.distance.value / 1000 : null,
                routeDurationMin: leg?.duration?.value ? leg.duration.value / 60 : null,
              });
              setMapState('ready');
              return;
            }

            setMapState('fallback');
          },
        );
      } catch {
        if (!cancelled) setMapState('fallback');
      }
    }

    drawMap();

    return () => {
      cancelled = true;
    };
  }, [origin, destination, ride.originCoords, ride.destinationCoords, onRouteReady]);

  return (
    <>
      <div className="route-map" aria-label="Mapa do trajeto">
        <div className="google-map-canvas" ref={mapNodeRef} />
        {mapState === 'loading' && <div className="map-loading">Carregando mapa real...</div>}
        {mapState === 'fallback' && (
          <div className="map-loading map-warning">
            Ative a chave do Google Maps para ver ruas reais e calcular a rota.
          </div>
        )}
      </div>
      <div className="map-route-label">
        <span><MapPin size={14} /> {origin || 'Origem'}</span>
        <span><Navigation2 size={14} /> {destination || 'Destino'}</span>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
