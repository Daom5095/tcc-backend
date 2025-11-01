/*
 * Modelo de datos para el Usuario (User).
 * Define la estructura de un usuario en la colección 'users' de MongoDB.
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, // El nombre es obligatorio
    trim: true // Limpia espacios en blanco al inicio y al final
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
    // Defino los únicos roles válidos para el sistema
    enum: ['revisor','supervisor','admin'], 
    default: 'revisor' // Por defecto, un usuario nuevo es 'revisor'
  },
}, { 
  // Agrego automáticamente los campos 'createdAt' y 'updatedAt'
  timestamps: true 
});

// Exporto el modelo 'User' basado en el esquema que definí
module.exports = mongoose.model('User', userSchema);