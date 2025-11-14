/*
 * Modelo de datos para la Notificación (Notification).
 * Almacena un historial de todas las notificaciones enviadas a los usuarios.
 * Esto permite al usuario ver notificaciones pasadas si no estaba conectado.
 * Define la estructura de la colección 'notifications'.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema({
  // A quién le pertenece esta notificación (Relación con 'User')
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true // Indexamos por usuario para búsquedas rápidas (GET /api/notifications)
  },
  
  message: {
    type: String,
    required: true
  },
  
  // Para saber si el usuario ya la vio (y cambiar el ícono en el frontend)
  read: {
    type: Boolean,
    default: false
  },
  
  // (Opcional) Un enlace para que el frontend sepa a dónde redirigir al hacer clic
  link: {
    type: String 
  },
  
  // (Opcional) Para agrupar notificaciones o mostrar un ícono
  type: {
    type: String,
    enum: ['process', 'incident', 'chat', 'system'], // Tipos de notificaciones
    default: 'system'
  }

}, { timestamps: true }); // 'createdAt' es clave para ordenarlas

module.exports = mongoose.model('Notification', notificationSchema);