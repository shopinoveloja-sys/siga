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
  { name: 'SIGA Pop', time: '4 min', price: 'R$ 22,90', note: 'economico' },
  { name: 'SIGA Comfort', time: '2 min', price: 'R$ 31,40', note: 'recomendado' },
  { name: 'SIGA Black', time: '6 min', price: 'R$ 48,90', note: 'premium' },
];

const passengerSteps = [
  { label: 'Origem', value: 'Av. Paulista, 1578', icon: MapPin },
  { label: 'Destino', value: 'Congonhas', icon: Navigation2 },
  { label: 'Pagamento', value: 'Carteira SIGA', icon: WalletCards },
];

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
  driver: null,
  vehicle: null,
};

function App() {
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState('passenger');
  const [selectedRide, setSelectedRide] = useState(1);
  const [online, setOnline] = useState(true);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [ride, setRide] = useState(initialRide);
  const activeRide = rideOptions[selectedRide];
  const isPassenger = mode === 'passenger';

  const cta = useMemo(() => {
    if (isPassenger) {
      if (ride.status === 'idle' || ride.status === 'cancelled' || ride.status === 'completed') return `Chamar ${activeRide.name}`;
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
  }, [activeRide, isPassenger, online, ride.status]);

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
        emitRide('ride:request', {
          category: activeRide.name,
          price: activeRide.price,
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
          <div className="map-grid">
            <span className="street street-a" />
            <span className="street street-b" />
            <span className="street street-c" />
            <span className="route route-a" />
            <span className="route route-b" />
            <span className="map-pin start"><MapPin size={17} /></span>
            <span className="map-pin car"><CarFront size={17} /></span>
            <span className="map-pin end"><Navigation2 size={17} /></span>
          </div>

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

function PassengerView({ activeRide, selectedRide, setSelectedRide, ride, connected, emitRide }) {
  const hasActiveRide = !['idle', 'completed', 'cancelled'].includes(ride.status);

  return (
    <>
      <div className="sheet-handle" />
      <RealtimeBanner connected={connected} ride={ride} />
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

      <div className="section-title">
        <h1>{hasActiveRide ? rideLabels[ride.status] : 'Escolha sua corrida'}</h1>
        <span>{hasActiveRide ? ride.price : activeRide.time}</span>
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
              <b>{rideOption.price}</b>
            </button>
          ))}
        </div>
      )}

      <article className="safety-card">
        <ShieldCheck size={22} />
        <div>
          <strong>Viagem protegida</strong>
          <p>Codigo de embarque, rota compartilhada e suporte ativo durante toda a corrida.</p>
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

createRoot(document.getElementById('root')).render(<App />);
