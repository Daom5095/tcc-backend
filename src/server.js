/*
 * Este es el archivo principal que arranca todo el backend.
 * Carga la configuración, inicializa Express, Socket.io y se conecta a la BD.
 */
require('dotenv').config(); // Carga las variables de entorno (PORT, MONGO_URI, etc.)
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const app = require('./app'); // Importo la configuración de Express
const { initSockets } = require('./sockets'); // Importo mi lógica de Sockets

// Defino el puerto desde el .env o uso 4000 por defecto
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

// Creo el servidor HTTP basado en mi app de Express
const server = http.createServer(app);

// Inicializo Socket.io y lo conecto al servidor HTTP
// Configuro CORS para permitir conexiones desde cualquier origen (*)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});


// Hago que 'io' sea accesible globalmente en la app de Express
// Esto es CRUCIAL para poder emitir eventos desde las rutas (ej. /api/processes)
app.set('io', io); 

// Le paso la instancia de 'io' a mi módulo de sockets para que configure los eventos
initSockets(io); 

// Configuración básica de conexión de Socket.io (solo para log)
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Función asíncrona para arrancar el servidor
async function start() {
  try {
    // 1. Conectar a MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado');
    
    // 2. Si la BD conecta, pongo el servidor a escuchar
    server.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    // Si falla la conexión a la BD, la aplicación no debe iniciar
    console.error('Error conectando MongoDB:', err.message);
    process.exit(1);
  }
}

// Ejecuto la función de arranque
start();