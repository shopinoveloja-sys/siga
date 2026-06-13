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

const initialRide = {
  id: null,
  status: 'idle',
  category: null,
  price: null,
  origin: 'Av. Paulista, 1578',
  destination: 'Congonhas',
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

io.on('connection', (socket) => {
  socket.emit('ride:update', ride);

  socket.on('ride:request', (payload = {}) => {
    updateRide({
      id: `SIGA-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'requested',
      category: payload.category || 'SIGA Comfort',
      price: payload.price || 'R$ 31,40',
      driver: null,
      vehicle: null,
    });
  });

  socket.on('ride:accept', () => {
    if (ride.status !== 'requested') return;
    updateRide({
      status: 'accepted',
      driver: 'Marina Prado',
      vehicle: 'Honda City vermelho - SIGA-2048',
    });
  });

  socket.on('ride:arrive', () => {
    if (ride.status !== 'accepted') return;
    updateRide({ status: 'arrived' });
  });

  socket.on('ride:start', () => {
    if (ride.status !== 'arrived') return;
    updateRide({ status: 'started' });
  });

  socket.on('ride:finish', () => {
    if (ride.status !== 'started') return;
    updateRide({ status: 'completed' });
  });

  socket.on('ride:cancel', () => {
    if (ride.status === 'idle') return;
    updateRide({ status: 'cancelled' });
  });

  socket.on('ride:reset', () => {
    ride = { ...initialRide, updatedAt: Date.now() };
    publish();
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: ride.status });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`SIGA realtime server listening on ${PORT}`);
});
