/*
 * Modelo de datos para la Notificación (Notification).
 * Almacena un historial de todas las notificaciones enviadas a los usuarios.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema({
  // A quién le pertenece esta notificación
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true // Indexamos por usuario para búsquedas rápidas
  },
  
  message: {
    type: String,
    required: true
  },
  
  // Para saber si el usuario ya la vio
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
    enum: ['process', 'incident', 'chat', 'system'],
    default: 'system'
  }

}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);