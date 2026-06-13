import React, { useEffect, useMemo, useState } from 'react';
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
  const candidates = simulatedDrivers
    .map((driver) => ({ ...driver, distanceKm: distanceBetweenKm(originCoords, driver.coords) }))
    .filter((driver) => driver.distanceKm <= radiusKm)
    .sort((a, b) => b.distanceKm - a.distanceKm);
  return candidates[0] || null;
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
  const originCoords = routePreview?.originCoords || fallbackCoords(origin, 0);
  const selectedDriver = base.isReady ? findFarthestDriverWithinRadius(originCoords, 5) : null;

  if (!base.isReady) {
    return { ...base, hasDriver: false, driver: null, price: 'Informe rota' };
  }

  if (!selectedDriver) {
    return {
      ...base,
      hasDriver: false,
      driver: null,
      pickupDistanceKm: 0,
      billableKm: Number(base.distanceKm).toFixed(1),
      priceNumber: 0,
      price: 'Indisponivel',
    };
  }

  const pickupDistanceKm = selectedDriver.distanceKm;
  const billableKm = Number(base.distanceKm) + pickupDistanceKm;
  const durationMin = Math.round(Number(base.distanceKm) * 2.4 + pickupDistanceKm * 2.1 + 6);
  const priceNumber = billableKm * ride.ratePerKm;

  return {
    ...base,
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
  const [selectedRide, setSelectedRide] = useState(1);
  const [online, setOnline] = useState(true);
  const [origin, setOrigin] = useState('Av. Paulista, 1578');
  const [destination, setDestination] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [routePreview, setRoutePreview] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [ride, setRide] = useState(initialRide);
  const activeRide = rideOptions[selectedRide];
  const isPassenger = mode === 'passenger';
  const estimate = useMemo(
    () => estimateRouteWithDriver(origin, destination, activeRide, routePreview),
    [origin, destination, activeRide, routePreview],
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
          originCoords: routePreview?.originCoords || fallbackCoords(origin, 0),
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
  return (
    <div className="driver-demand-map">
      <span className="demand-water demand-water-one" />
      <span className="demand-water demand-water-two" />
      <span className="demand-park demand-park-one" />
      <span className="demand-park demand-park-two" />
      <span className="demand-road demand-road-one" />
      <span className="demand-road demand-road-two" />
      <span className="demand-road demand-road-three" />
      <span className="heat heat-one" />
      <span className="heat heat-two" />
      <span className="heat heat-three" />
      <span className="heat heat-four" />
      <span className="bonus bonus-one">+R$ 14,75</span>
      <span className="bonus bonus-two">+R$ 7,75</span>
      <span className="bonus bonus-three">+R$ 9,50</span>
      <span className="bonus bonus-four">+R$ 20</span>
      <span className="bonus bonus-five">+R$ 2</span>
      <span className="driver-position"><Navigation2 size={28} /></span>
      {ride.status !== 'idle' && (
        <>
          <svg className="driver-trip-route" viewBox="0 0 360 680" preserveAspectRatio="none">
            <path d="M180 330 C210 282 235 240 260 192 S304 104 316 58" />
          </svg>
          <span className="pickup-pin">A</span>
          <span className="dropoff-pin">B</span>
        </>
      )}
      <span className="map-place place-one">Aeroporto</span>
      <span className="map-place place-two">Centro</span>
      <span className="map-place place-three">Campo</span>
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
  useEffect(() => {
    const activeOrigin = ride.originCoords || fallbackCoords(origin || '', 0);
    const activeDestination = ride.destinationCoords || fallbackCoords(destination || '', 1);
    onRouteReady?.({ originCoords: activeOrigin, destinationCoords: activeDestination });
  }, [origin, destination, ride.originCoords, ride.destinationCoords, onRouteReady]);

  return (
    <>
      <div className="route-map" aria-label="Mapa do trajeto">
        <span className="map-street map-street-one" />
        <span className="map-street map-street-two" />
        <span className="map-street map-street-three" />
        <span className="map-street map-street-four" />
        <svg className="route-drawing" viewBox="0 0 360 220" preserveAspectRatio="none" aria-hidden="true">
          <path className="route-shadow" d="M62 154 C122 112 168 126 214 84 S286 64 316 38" />
          <path className="route-path" d="M62 154 C122 112 168 126 214 84 S286 64 316 38" />
        </svg>
        <span className="route-dot route-dot-a">A</span>
        <span className="route-dot route-dot-b">B</span>
      </div>
      <div className="map-route-label">
        <span><MapPin size={14} /> {origin || 'Origem'}</span>
        <span><Navigation2 size={14} /> {destination || 'Destino'}</span>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
