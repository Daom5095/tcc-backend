/*
 * Modelo de datos para el Usuario (User).
 * --- ¡MODIFICADO CON "isActive" (FASE 3 - PASO 9)! ---
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true 
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['revisor','supervisor','admin'], 
    default: 'revisor'
  },
  // --- NUEVO CAMPO ---
  isActive: {
    type: Boolean,
    default: true,
    required: true
  }
  // --- FIN DE NUEVO CAMPO ---
}, { 
  timestamps: true 
});

module.exports = mongoose.model('User', userSchema);