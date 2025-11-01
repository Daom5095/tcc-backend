/*
 * Rutas de Usuarios (/api/users).
 * Se usa para obtener una lista de usuarios (ej. para la lista de contactos del chat).
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const User = require('../models/User');

/* =========================================================
   👥 OBTENER LISTA DE TODOS LOS USUARIOS
   GET /api/users/
   ========================================================= */
// Devuelve todos los usuarios EXCEPTO yo mismo.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    
    // Busco todos los usuarios que NO tengan mi ID
    const users = await User.find({ _id: { $ne: myId } })
                            .select('name email role'); // Solo devuelvo estos campos
    
    res.json(users);

  } catch (err) {
    console.error('Error en GET /api/users:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;