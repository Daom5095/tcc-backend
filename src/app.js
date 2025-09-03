// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

module.exports = app;
