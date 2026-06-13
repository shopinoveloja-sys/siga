import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
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

function App() {
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState('passenger');
  const [selectedRide, setSelectedRide] = useState(1);
  const [online, setOnline] = useState(true);
  const activeRide = rideOptions[selectedRide];
  const isPassenger = mode === 'passenger';

  const cta = useMemo(() => {
    if (isPassenger) return `Chamar ${activeRide.name}`;
    return online ? 'Receber corridas' : 'Ficar online';
  }, [activeRide, isPassenger, online]);

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
            />
          ) : (
            <DriverView online={online} setOnline={setOnline} />
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

        <button className="main-cta">
          {cta}
          <ChevronRight size={20} />
        </button>
      </section>
    </main>
  );
}

function PassengerView({ activeRide, selectedRide, setSelectedRide }) {
  return (
    <>
      <div className="sheet-handle" />
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
        <h1>Escolha sua corrida</h1>
        <span>{activeRide.time}</span>
      </div>

      <div className="ride-list">
        {rideOptions.map((ride, index) => (
          <button
            className={selectedRide === index ? 'ride-row selected' : 'ride-row'}
            key={ride.name}
            onClick={() => setSelectedRide(index)}
          >
            <span className="ride-avatar"><CarFront size={21} /></span>
            <div>
              <strong>{ride.name}</strong>
              <small>{ride.time} de espera - {ride.note}</small>
            </div>
            <b>{ride.price}</b>
          </button>
        ))}
      </div>

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

function DriverView({ online, setOnline }) {
  return (
    <>
      <div className="sheet-handle" />
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
        <h1>Chamada sugerida</h1>
        <span>R$ 42,60</span>
      </div>

      <article className="trip-card">
        <div className="trip-route">
          <span />
          <div>
            <strong>Pinheiros</strong>
            <small>Embarque em 4 min</small>
          </div>
        </div>
        <div className="trip-route">
          <span />
          <div>
            <strong>Vila Olimpia</strong>
            <small>8,2 km - 18 min</small>
          </div>
        </div>
      </article>

      <div className="quality-list">
        <Quality icon={Star} label="Nota" value="4.98" />
        <Quality icon={MessageCircle} label="Resposta" value="11s" />
        <Quality icon={Headphones} label="Suporte" value="Ativo" />
        <Quality icon={Heart} label="Favoritos" value="24" />
      </div>
    </>
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
