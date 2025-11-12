/*
 * Rutas de Notificaciones (/api/notifications).
 * Permite al usuario logueado obtener su historial de notificaciones
 * y marcar notificaciones como leídas.
 * --- ¡MODIFICADO CON DELETE (BUG FIX)! ---
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // <-- Asegúrate de que mongoose esté importado
const authMiddleware = require('../middlewares/auth'); // Protegido por auth
const Notification = require('../models/Notification'); // Modelo Notification

/* =========================================================
   OBTENER MIS NOTIFICACIONES
   GET /api/notifications/
   ========================================================= */
router.get('/', authMiddleware, async (req, res) => {
  try {
    // 1. Busco todas las notificaciones que pertenezcan a MI usuario
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
// Este endpoint es para cuando el usuario abre el panel de notificaciones
// y quiero marcar todas como 'leídas' de un solo golpe.
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    // 1. Busca todas las notificaciones NO leídas (read: false)
    //    de este usuario y las actualiza a 'read: true'.
    await Notification.updateMany(
      { user: req.user.id, read: false }, // El filtro
      { $set: { read: true } } // La actualización
    );
    
    res.status(200).json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    console.error('Error en PUT /api/notifications/read-all:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


/* =========================================================
   ELIMINAR UNA NOTIFICACIÓN
   DELETE /api/notifications/:id
   ========================================================= */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id: notificationId } = req.params;
    const userId = req.user.id;

    // Validación de ID
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: 'ID de notificación no válido' });
    }

    // Usamos findOneAndDelete para buscar Y eliminar en un solo paso.
    // Lo más importante: nos aseguramos de que el 'user' de la notificación
    // sea el mismo 'user' del token. Esto evita que un usuario borre
    // notificaciones de otro.
    const deletedNotification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId 
    });

    if (!deletedNotification) {
      // Si no se encontró, o ya estaba borrada o no le pertenecía al usuario
      return res.status(404).json({ message: 'Notificación no encontrada o no autorizado' });
    }
    
    // Éxito
    res.status(200).json({ message: 'Notificación eliminada' });

  } catch (err) {
    console.error('Error en DELETE /api/notifications/:id:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});
// --- ¡FIN DE CÓDIGO NUEVO! ---


module.exports = router;