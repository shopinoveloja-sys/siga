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
  MapPin,
  Menu,
  MessageCircle,
  Navigation2,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  WalletCards,
  Zap,
} from 'lucide-react';
import './styles.css';

const passengerSteps = [
  { label: 'Origem', value: 'Av. Paulista, 1578', icon: MapPin },
  { label: 'Destino', value: 'Aeroporto de Congonhas', icon: Navigation2 },
  { label: 'Categoria', value: 'SIGA Comfort', icon: CarFront },
  { label: 'Pagamento', value: 'Carteira SIGA', icon: WalletCards },
];

const driverSignals = [
  { label: 'Demanda agora', value: 'Alta', detail: 'Pinheiros e Itaim', icon: RadioTower },
  { label: 'Aceite inteligente', value: '92%', detail: 'Rotas com melhor ganho', icon: Gauge },
  { label: 'Ganho previsto', value: 'R$ 318', detail: 'Proximas 4 horas', icon: CircleDollarSign },
];

const routeCards = [
  { name: 'SIGA Eco', time: '4 min', price: 'R$ 24,80', tag: 'menor preco' },
  { name: 'SIGA Comfort', time: '2 min', price: 'R$ 31,40', tag: 'mais escolhido' },
  { name: 'SIGA Black', time: '6 min', price: 'R$ 48,90', tag: 'premium' },
];

const safetyItems = [
  'Compartilhamento automatico da rota',
  'Confirmacao por codigo antes do embarque',
  'Monitoramento de paradas inesperadas',
];

function App() {
  const [mode, setMode] = useState('passenger');
  const [selectedRide, setSelectedRide] = useState(1);
  const [online, setOnline] = useState(true);

  const activeRide = routeCards[selectedRide];
  const accent = mode === 'passenger' ? 'Passageiro' : 'Motorista';
  const eta = useMemo(() => (mode === 'passenger' ? activeRide.time : '01:42'), [mode, activeRide]);

  return (
    <main className="app-shell">
      <section className="hero-grid">
        <nav className="topbar" aria-label="Navegacao principal">
          <div className="brand-mark">
            <span>S</span>
            <strong>SIGA</strong>
          </div>
          <div className="mode-switch" aria-label="Escolher experiencia">
            <button className={mode === 'passenger' ? 'active' : ''} onClick={() => setMode('passenger')}>
              <UserRound size={17} />
              Passageiro
            </button>
            <button className={mode === 'driver' ? 'active' : ''} onClick={() => setMode('driver')}>
              <CarFront size={17} />
              Motorista
            </button>
          </div>
          <button className="icon-button" aria-label="Abrir menu">
            <Menu size={22} />
          </button>
        </nav>

        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} />
            Experiencia {accent}
          </span>
          <h1>{mode === 'passenger' ? 'Sua cidade responde no ritmo da sua jornada.' : 'Dirija com inteligencia, previsao e controle.'}</h1>
          <p>
            {mode === 'passenger'
              ? 'Escolha rotas, acompanhe seu motorista e mantenha seguranca ativa em uma interface que respira movimento.'
              : 'Veja demanda, ganhos, aceite e suporte em um painel pensado para decisoes rapidas na rua.'}
          </p>
          <div className="hero-actions">
            <button className="primary-action">
              {mode === 'passenger' ? 'Solicitar corrida' : online ? 'Receber chamadas' : 'Ficar online'}
              <ChevronRight size={18} />
            </button>
            <button className="ghost-action">
              <ShieldCheck size={18} />
              Central de seguranca
            </button>
          </div>
        </div>

        <section className="map-stage" aria-label="Mapa operacional SIGA">
          <div className="city-map">
            <span className="route-line route-one" />
            <span className="route-line route-two" />
            <span className="route-line route-three" />
            <span className="pin pickup"><MapPin size={18} /></span>
            <span className="pin car"><CarFront size={18} /></span>
            <span className="pin target"><Navigation2 size={18} /></span>
          </div>

          <div className="live-card">
            <div>
              <span className="micro-label">{mode === 'passenger' ? 'Motorista chegando' : 'Proxima corrida'}</span>
              <strong>{eta}</strong>
            </div>
            <div className="driver-mini">
              <span>LS</span>
              <div>
                <b>{mode === 'passenger' ? 'Lucas Santos' : 'Marina Prado'}</b>
                <small>{mode === 'passenger' ? 'Honda City - 4.97' : 'R$ 42,60 - 8,2 km'}</small>
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="experience-grid">
        {mode === 'passenger' ? (
          <>
            <Panel title="Fluxo da corrida" icon={Clock3}>
              <div className="step-list">
                {passengerSteps.map((step) => (
                  <div className="step-item" key={step.label}>
                    <span><step.icon size={18} /></span>
                    <div>
                      <small>{step.label}</small>
                      <strong>{step.value}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Categorias inteligentes" icon={Zap} wide>
              <div className="ride-options">
                {routeCards.map((ride, index) => (
                  <button
                    className={selectedRide === index ? 'ride-option selected' : 'ride-option'}
                    onClick={() => setSelectedRide(index)}
                    key={ride.name}
                  >
                    <span className="ride-icon"><CarFront size={22} /></span>
                    <b>{ride.name}</b>
                    <small>{ride.time} de espera</small>
                    <strong>{ride.price}</strong>
                    <em>{ride.tag}</em>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Confianca em tempo real" icon={ShieldCheck}>
              <ul className="clean-list">
                {safetyItems.map((item) => (
                  <li key={item}><CheckCircle2 size={18} />{item}</li>
                ))}
              </ul>
            </Panel>
          </>
        ) : (
          <>
            <Panel title="Painel ativo" icon={Gauge}>
              <div className="status-row">
                <span className={online ? 'status-dot online' : 'status-dot'} />
                <div>
                  <small>Status</small>
                  <strong>{online ? 'Online e priorizado' : 'Pausado'}</strong>
                </div>
                <button className="mini-toggle" onClick={() => setOnline(!online)}>{online ? 'Pausar' : 'Ativar'}</button>
              </div>
              <div className="metric-ring">
                <span>R$</span>
                <strong>186</strong>
                <small>hoje</small>
              </div>
            </Panel>

            <Panel title="Sinais da cidade" icon={RadioTower} wide>
              <div className="signal-grid">
                {driverSignals.map((signal) => (
                  <article className="signal-card" key={signal.label}>
                    <signal.icon size={22} />
                    <small>{signal.label}</small>
                    <strong>{signal.value}</strong>
                    <span>{signal.detail}</span>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Qualidade" icon={Star}>
              <div className="quality-stack">
                <Quality label="Nota dos passageiros" value="4.98" icon={Heart} />
                <Quality label="Tempo de resposta" value="11s" icon={MessageCircle} />
                <Quality label="Suporte prioritario" value="ativo" icon={Headphones} />
              </div>
            </Panel>
          </>
        )}
      </section>

      <section className="bottom-command">
        <div>
          <span className="micro-label">Resumo SIGA</span>
          <strong>{mode === 'passenger' ? `${activeRide.name} selecionado` : 'Janela lucrativa detectada'}</strong>
          <p>{mode === 'passenger' ? 'Rota monitorada, pagamento protegido e embarque por codigo.' : 'A zona sugerida aumenta a chance de corridas curtas com melhor retorno.'}</p>
        </div>
        <div className="command-actions">
          <button><Bell size={18} /> Alertas</button>
          <button><CreditCard size={18} /> Carteira</button>
          <button><TrendingUp size={18} /> Insights</button>
        </div>
      </section>
    </main>
  );
}

function Panel({ title, icon: Icon, children, wide = false }) {
  return (
    <article className={wide ? 'panel wide-panel' : 'panel'}>
      <header>
        <span><Icon size={18} /></span>
        <h2>{title}</h2>
      </header>
      {children}
    </article>
  );
}

function Quality({ label, value, icon: Icon }) {
  return (
    <div className="quality-item">
      <span><Icon size={18} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
