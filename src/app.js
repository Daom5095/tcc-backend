/*
 * Este archivo (app.js) define la aplicación Express y sus middlewares.
 * Es como el 'cerebro' que conecta todas las piezas: rutas, seguridad y logs.
 */
const express = require('express');
const cors = require('cors'); // Middleware para permitir peticiones Cross-Origin
const helmet = require('helmet'); // Middleware para seguridad (agrega headers HTTP)
const authRoutes = require('./routes/auth'); // Mis rutas de autenticación
const errorHandler = require('./middlewares/errorHandler'); // Mi manejador de errores
const morgan = require('morgan'); // Middleware para loggear peticiones HTTP
const statsRoutes = require('./routes/stats'); // Mis rutas de estadísticas
const processRoutes = require('./routes/process'); // Mis rutas de procesos (core)
const conversationRoutes = require('./routes/conversations'); // Mis rutas de chats
const reportRoutes = require('./routes/reports'); // Mis rutas de reportes

// --- ¡NUEVA RUTA! ---
const userRoutes = require('./routes/users'); // Mis rutas de usuarios (contactos)

const app = express();


// --- CONFIGURACIÓN DE MIDDLEWARES GLOBALES ---
app.use(express.json({ limit: '1mb' })); 
app.use(cors());
app.use(helmet()); 
app.use(morgan('dev'));


// --- DEFINICIÓN DE RUTAS DE LA API ---
app.use('/auth', authRoutes);
app.use('/stats', statsRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/reports', reportRoutes);

// --- ¡CONECTO LA NUEVA RUTA! ---
app.use('/api/users', userRoutes);


// --- RUTAS DE SALUD Y MANEJO DE ERRORES ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.use(errorHandler);

// Exporto la 'app' para que server.js pueda usarla
module.exports = app;