/*
 * Modelo de datos para el Mensaje (Message).
 * Representa un único mensaje enviado en una 'Conversación'.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Un sub-esquema para adjuntos (si decido implementarlo)
const attachmentSchema = new Schema({
  url: String, // URL del archivo
  type: String, // 'imagen', 'pdf', etc.
}, { _id: false }); // No creo un _id para el sub-documento

const messageSchema = new Schema({
  // A qué conversación pertenece
  conversationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Conversation', 
    required: true 
  },
  // Quién envió el mensaje
  senderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // Guardo el nombre del sender (denormalización)
  // Esto evita tener que hacer 'populate' al 'senderId' solo para ver el nombre
  senderName: { 
    type: String 
  }, 
  content: { 
    type: String 
  },
  // Array de adjuntos (opcional)
  attachments: [attachmentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);