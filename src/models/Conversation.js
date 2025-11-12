/*
 * Modelo de datos para la Conversación (Conversation).
 * Agrupa mensajes, ya sea en un chat 'público' (como 'general')
 * o en un chat 'privado' entre dos o más usuarios.
 * Define la estructura de la colección 'conversations'.
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
  // (En 'public' puede estar vacío, pero en 'private' es [userId1, userId2])
  participants: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  
  // Guardo la fecha del último mensaje para ordenar las conversaciones
  // en la lista de chats del frontend (la más reciente arriba).
  lastMessageAt: Date, 
}, { timestamps: true });

// Exporto el modelo 'Conversation'
module.exports = mongoose.model('Conversation', conversationSchema);