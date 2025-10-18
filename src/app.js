const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const errorHandler = require('./middlewares/errorHandler');
const morgan = require('morgan');
const statsRoutes = require('./routes/stats');
const processRoutes = require('./routes/process');

const app = express();


app.use(express.json({ limit: '1mb' })); 
app.use(cors());
app.use(helmet()); 
app.use(morgan('dev'));


// Rutas de la aplicación
app.use('/auth', authRoutes);
app.use('/stats', statsRoutes);
app.use('/api/processes', processRoutes);

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});


app.use(errorHandler);

module.exports = app;