/*
 * Rutas de Notificaciones (/api/notifications).
 * Permite al usuario logueado obtener su historial y marcar notificaciones como leídas.
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const Notification = require('../models/Notification');

/* =========================================================
   OBTENER MIS NOTIFICACIONES
   GET /api/notifications/
   ========================================================= */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 }) // Las más nuevas primero
      .limit(50); // Limita a las últimas 50
      
    res.json(notifications);
  } catch (err) {
    console.error('Error en GET /api/notifications:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   MARCAR NOTIFICACIONES COMO LEÍDAS
   PUT /api/notifications/read-all
   ========================================================= */
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    // Busca todas las notificaciones NO leídas de este usuario y las actualiza
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } }
    );
    
    res.status(200).json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    console.error('Error en PUT /api/notifications/read-all:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;