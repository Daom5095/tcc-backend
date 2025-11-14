/*
 * Modelo de datos para el Usuario (User).
 * * Este schema define la estructura de un usuario en la colección 'users'.
 * Es la entidad base para la autenticación y los roles.
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, // El nombre es obligatorio
    trim: true // Elimina espacios en blanco al inicio y al final
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, // No pueden existir dos usuarios con el mismo email
    lowercase: true, // Guardo el email siempre en minúsculas
    trim: true 
  },
  // Guardo el hash de la contraseña, NUNCA la contraseña en texto plano
  passwordHash: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    // Defino los únicos roles permitidos en el sistema
    enum: ['revisor','supervisor','admin'], 
    default: 'revisor' // Si no se especifica, se crea como 'revisor'
  },
  
  // Este campo lo añadí para la gestión de administradores (Fase 3).
  // Me permite "desactivar" un usuario sin borrarlo de la BD.
  isActive: {
    type: Boolean,
    default: true,
    required: true
  }
}, { 
  // Opciones del Schema:
  // 'timestamps: true' le dice a Mongoose que añada automáticamente
  // los campos 'createdAt' y 'updatedAt' a cada documento.
  timestamps: true 
});

// Exporto el modelo 'User' basado en el 'userSchema'.
// Mongoose automáticamente buscará/creará la colección 'users' (en plural).
module.exports = mongoose.model('User', userSchema);