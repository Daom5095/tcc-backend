/*
 * Este es el archivo principal que arranca todo el backend (entry point).
 * Su responsabilidad es:
 * 1. Cargar las variables de entorno (desde .env).
 * 2. Conectar a la base de datos (MongoDB).
 * 3. Crear el servidor HTTP.
 * 4. Inicializar y vincular Socket.io al servidor HTTP.
 * 5. Poner el servidor a escuchar en el puerto definido.
 */

// 1. Carga las variables de entorno (PORT, MONGO_URI, JWT_SECRET) desde .env
require('dotenv').config(); 
const http = require('http');
const { Server } = require('socket.io'); // Importo el constructor de Socket.io
const mongoose = require('mongoose');
const app = require('./app'); // Importo MI aplicación Express desde app.js
const { initSockets } = require('./sockets'); // Importo mi lógica de Sockets

// 2. Defino el puerto desde el .env o uso 4000 por defecto
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

// 3. Creo el servidor HTTP basado en mi app de Express
const server = http.createServer(app);

// 4. Inicializo Socket.io y lo conecto al servidor HTTP
const io = new Server(server, {
  cors: {
    // Configuro CORS para Socket.io, permitiendo cualquier origen
    // (Idealmente en producción se restringe al dominio del frontend)
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});


// Hago que 'io' sea accesible globalmente en la app de Express.
// Esto es CRUCIAL para poder emitir eventos desde las rutas (ej. /api/processes)
// usando req.app.get('io')
app.set('io', io); 

// Le paso la instancia de 'io' a mi módulo de sockets (sockets/index.js)
// para que configure todos los manejadores de eventos (connection, chat, etc.)
initSockets(io); 

// (Este 'io.on' es solo un log genérico de conexión/desconexión)
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

/**
 * Función asíncrona para arrancar el servidor.
 * Usé una función 'start' para poder usar async/await y asegurar
 * que primero conecte a la BD y LUEGO inicie el servidor.
 */
async function start() {
  try {
    // 1. Conectar a MongoDB usando la URI de mi .env
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado');
    
    // 2. Si la BD conecta, pongo el servidor a escuchar peticiones
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