/*
 * Modelo de datos para la Conversación (Conversation).
 * Agrupa mensajes, ya sea en un chat 'público' (como 'general')
 * o en un chat 'privado' entre dos o más usuarios.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const conversationSchema = new Schema({
  type: { 
    type: String, 
    enum: ['public','private'], // 'public' (salas), 'private' (directos)
    default: 'public' 
  },
  // Quiénes participan en esta conversación
  // (En 'public' puede estar vacío o no usarse)
  participants: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  // Guardo la fecha del último mensaje para ordenar las conversaciones
  lastMessageAt: Date, 
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);