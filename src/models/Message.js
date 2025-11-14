/*
 * Modelo de datos para el Mensaje (Message).
 * Representa un único mensaje enviado en una 'Conversación'.
 * Define la estructura de la colección 'messages'.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;



const attachmentSchema = new Schema({
  url: String, // URL del archivo
  type: String, // 'imagen', 'pdf', etc.
}, { _id: false }); // No creo un _id para el sub-documento

const messageSchema = new Schema({
  // A qué conversación pertenece (Relación con 'Conversation')
  conversationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Conversation', 
    required: true 
  },
  // Quién envió el mensaje (Relación con 'User')
  senderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Guardo el nombre del sender (denormalización)
  // Esto evita tener que hacer 'populate' al 'senderId' CADA VEZ
  // que cargo mensajes, mejorando mucho el rendimiento del chat.
  senderName: { 
    type: String 
  }, 
  
  content: { 
    type: String 
  },
  
  // Array de adjuntos (opcional, no implementado)
  attachments: [attachmentSchema],
}, { timestamps: true });


module.exports = mongoose.model('Message', messageSchema);