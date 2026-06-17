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
  pickupDistanceKm: null,
  billableKm: null,
  ratePerKm: null,
  assignedDriverName: null,
  assignedDriverDistanceKm: null,
  fareReferenceDriverName: null,
  fareReferenceDriverDistanceKm: null,
  originCoords: null,
  destinationCoords: null,
  passenger: 'Passageiro SIGA',
  driver: null,
  vehicle: null,
  updatedAt: Date.now(),
};

let ride = { ...initialRide };
let drivers = {};

function getActiveDrivers() {
  const now = Date.now();
  return Object.values(drivers).filter((driver) => now - driver.updatedAt <= 120000 && driver.online !== false);
}

function publish() {
  io.emit('ride:update', ride);
}

function publishDrivers() {
  io.emit('drivers:update', getActiveDrivers());
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
      pickupDistanceKm: payload.pickupDistanceKm || '5.0',
      billableKm: payload.billableKm || payload.distanceKm || '8.2',
      ratePerKm: payload.ratePerKm || '3.10',
      assignedDriverName: null,
      assignedDriverDistanceKm: null,
      fareReferenceDriverName: payload.fareReferenceDriverName || payload.assignedDriverName || null,
      fareReferenceDriverDistanceKm: payload.fareReferenceDriverDistanceKm || payload.assignedDriverDistanceKm || payload.pickupDistanceKm || '5.0',
      originCoords: payload.originCoords || null,
      destinationCoords: payload.destinationCoords || null,
      driver: null,
      vehicle: null,
    });
    return true;
  }

  if (event === 'ride:accept' && ride.status === 'requested') {
    const driverName = payload.driverName || payload.name || 'Motorista SIGA';
    updateRide({
      status: 'accepted',
      assignedDriverName: driverName,
      assignedDriverDistanceKm: payload.driverDistanceKm || null,
      driver: driverName,
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

function updateDriverLocation(payload = {}) {
  const coords = Array.isArray(payload.coords) ? payload.coords.map(Number) : null;
  if (!coords || coords.length !== 2 || coords.some((value) => Number.isNaN(value))) {
    return false;
  }

  const id = payload.id || 'driver-live';
  drivers[id] = {
    id,
    name: payload.name || 'Motorista SIGA',
    coords,
    online: payload.online !== false,
    updatedAt: Date.now(),
  };
  publishDrivers();
  return true;
}

io.on('connection', (socket) => {
  socket.emit('ride:update', ride);
  socket.emit('drivers:update', getActiveDrivers());

  socket.on('ride:request', (payload = {}) => {
    applyRideEvent('ride:request', payload);
  });

  socket.on('ride:accept', (payload = {}) => {
    applyRideEvent('ride:accept', payload);
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

  socket.on('driver:location', (payload = {}) => {
    updateDriverLocation(payload);
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: ride.status });
});

app.get('/api/config', (_req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  });
});

app.get('/api/ride', (_req, res) => {
  res.json(ride);
});

app.get('/api/drivers', (_req, res) => {
  res.json(getActiveDrivers());
});

app.post('/api/driver/location', (req, res) => {
  const applied = updateDriverLocation(req.body || {});
  res.status(applied ? 200 : 422).json({ applied, drivers: getActiveDrivers() });
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
