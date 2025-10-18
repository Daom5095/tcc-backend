require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const app = require('./app');
const { initSockets } = require('./sockets');

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});


// Hacemos que 'io' sea accesible globalmente en la app de Express
app.set('io', io); 


initSockets(io); 

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado');
    server.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Error conectando MongoDB:', err.message);
    process.exit(1);
  }
}

start();