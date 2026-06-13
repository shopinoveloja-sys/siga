import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = Number(process.env.PORT || 80);

app.use(express.json());

const initialRide = {
  id: null,
  status: 'idle',
  category: null,
  price: null,
  origin: 'Av. Paulista, 1578',
  destination: 'Congonhas',
  paymentMethod: null,
  distanceKm: null,
  durationMin: null,
  passenger: 'Passageiro SIGA',
  driver: null,
  vehicle: null,
  updatedAt: Date.now(),
};

let ride = { ...initialRide };

function publish() {
  io.emit('ride:update', ride);
}

function updateRide(next) {
  ride = {
    ...ride,
    ...next,
    updatedAt: Date.now(),
  };
  publish();
}

function applyRideEvent(event, payload = {}) {
  if (event === 'ride:request') {
    updateRide({
      id: `SIGA-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'requested',
      category: payload.category || 'SIGA Comfort',
      price: payload.price || 'R$ 31,40',
      origin: payload.origin || initialRide.origin,
      destination: payload.destination || initialRide.destination,
      paymentMethod: payload.paymentMethod || 'Carteira SIGA',
      distanceKm: payload.distanceKm || '8.2',
      durationMin: payload.durationMin || '18',
      driver: null,
      vehicle: null,
    });
    return true;
  }

  if (event === 'ride:accept' && ride.status === 'requested') {
    updateRide({
      status: 'accepted',
      driver: 'Marina Prado',
      vehicle: 'Honda City vermelho - SIGA-2048',
    });
    return true;
  }

  if (event === 'ride:arrive' && ride.status === 'accepted') {
    updateRide({ status: 'arrived' });
    return true;
  }

  if (event === 'ride:start' && ride.status === 'arrived') {
    updateRide({ status: 'started' });
    return true;
  }

  if (event === 'ride:finish' && ride.status === 'started') {
    updateRide({ status: 'completed' });
    return true;
  }

  if (event === 'ride:cancel' && ride.status !== 'idle') {
    updateRide({ status: 'cancelled' });
    return true;
  }

  if (event === 'ride:reset') {
    ride = { ...initialRide, updatedAt: Date.now() };
    publish();
    return true;
  }

  return false;
}

io.on('connection', (socket) => {
  socket.emit('ride:update', ride);

  socket.on('ride:request', (payload = {}) => {
    applyRideEvent('ride:request', payload);
  });

  socket.on('ride:accept', () => {
    applyRideEvent('ride:accept');
  });

  socket.on('ride:arrive', () => {
    applyRideEvent('ride:arrive');
  });

  socket.on('ride:start', () => {
    applyRideEvent('ride:start');
  });

  socket.on('ride:finish', () => {
    applyRideEvent('ride:finish');
  });

  socket.on('ride:cancel', () => {
    applyRideEvent('ride:cancel');
  });

  socket.on('ride:reset', () => {
    applyRideEvent('ride:reset');
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: ride.status });
});

app.get('/api/ride', (_req, res) => {
  res.json(ride);
});

app.post('/api/ride/reset', (_req, res) => {
  applyRideEvent('ride:reset');
  res.json(ride);
});

app.post('/api/ride/event', (req, res) => {
  const { event, payload } = req.body || {};
  const applied = applyRideEvent(event, payload);
  res.status(applied ? 200 : 409).json({ applied, ride });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`SIGA realtime server listening on ${PORT}`);
});
