const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const errorHandler = require('./middlewares/errorHandler');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const morgan = require('morgan');
const statsRoutes = require('./routes/stats');
const processRoutes = require('./routes/process'); // <-- LÍNEA NUEVA

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(morgan('dev'));

// Rutas de la aplicación
app.use('/auth', authRoutes);
app.use('/stats', statsRoutes);
app.use('/api/processes', processRoutes); 

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Manejador de errores (debe ir al final)
app.use(errorHandler);

module.exports = app;