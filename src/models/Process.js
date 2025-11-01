/*
 * Modelo de datos para el Proceso (Process).
 * Esta es la entidad principal del proyecto. Representa una tarea de revisión.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const processSchema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  status: {
    type: String,
    // El estado solo puede ser uno de estos valores
    enum: ['pendiente', 'en_revision', 'aprobado', 'rechazado'],
    default: 'pendiente' // Un proceso nuevo siempre inicia como 'pendiente'
  },
  
  // Quién creó/supervisa este proceso (Referencia al modelo 'User')
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // A quién se le asignó la revisión (Referencia al modelo 'User')
  assignedTo: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Historial de cambios (Requerido por el PDF para "mantener un historial")
  // [cite: 4]
  history: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' }, // Quién hizo el cambio
    action: String, // Qué hizo (ej. "Proceso Creado", "Proceso Aprobado")
    timestamp: { type: Date, default: Date.now } // Cuándo lo hizo
  }]
}, { 
  timestamps: true // Agrega createdAt y updatedAt
});

// Exporto el modelo
module.exports = mongoose.model('Process', processSchema);