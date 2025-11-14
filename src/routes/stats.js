/*
 * Rutas de Estadísticas (/stats).
 * Endpoints simples para obtener métricas generales del sistema.
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const auth = require('../middlewares/auth'); 

// GET /stats/
router.get('/', auth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    
    // Devuelvo las estadísticas
    res.json({ totalUsers, totalMessages });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

module.exports = router;