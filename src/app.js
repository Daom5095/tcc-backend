/*
 * Este archivo (app.js) define la aplicación Express y sus middlewares.
 * Es como el 'cerebro' que conecta todas las piezas: rutas, seguridad y logs.
 * No arranca el servidor, solo exporta la 'app' configurada.
 */
const express = require('express');
const cors = require('cors'); // Middleware para permitir peticiones Cross-Origin
const helmet = require('helmet'); // Middleware para seguridad (agrega headers HTTP)
const errorHandler = require('./middlewares/errorHandler'); // Mi manejador de errores
const morgan = require('morgan'); // Middleware para loggear peticiones HTTP
const path = require('path');

// --- Importo TODOS mis módulos de rutas ---
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const processRoutes = require('./routes/process');
const conversationRoutes = require('./routes/conversations');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();


// --- CONFIGURACIÓN DE MIDDLEWARES GLOBALES ---
// (Se ejecutan para CADA petición que llega)

// 1. Middleware para parsear JSON (ej. req.body)
app.use(express.json({ limit: '1mb' })); 

// 2. Habilito CORS para todas las rutas
app.use(cors());

// 3. Habilito Helmet para headers de seguridad básicos
app.use(helmet()); 

// 4. Habilito Morgan en modo 'dev' para ver logs de peticiones en consola
app.use(morgan('dev'));

// 5. Middleware para servir archivos estáticos (imágenes de incidencias)
// Le digo a Express que si una petición empieza con '/uploads',
// debe buscar el archivo en la carpeta 'uploads' del proyecto.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));


// --- DEFINICIÓN DE RUTAS DE LA API ---
// Aquí conecto mis módulos de rutas a la app principal.
// Todas las rutas en 'authRoutes' tendrán el prefijo '/auth'
app.use('/auth', authRoutes);
// Todas las rutas en 'statsRoutes' tendrán el prefijo '/stats'
app.use('/stats', statsRoutes);
// Todas las rutas en 'processRoutes' tendrán el prefijo '/api/processes'
app.use('/api/processes', processRoutes);
// ...y así sucesivamente
app.use('/api/conversations', conversationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);


// --- RUTAS DE SALUD Y MANEJO DE ERRORES ---

// Un endpoint simple de 'health check' para saber si la app está viva
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// 7. Middleware de Manejo de Errores.
app.use(errorHandler);

module.exports = app;