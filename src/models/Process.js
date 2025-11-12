/*
 * Modelo de datos para el Proceso (Process).
 * Esta es la entidad principal del proyecto. Representa una tarea de revisión.
 * Define la estructura de la colección 'processes'.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose; // Obtengo el constructor de Schema

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
  // Guardo el ObjectId del usuario creador.
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', // 'ref' le dice a Mongoose a qué modelo apunta este ID
    required: true 
  },
  
  // A quién se le asignó la revisión (Referencia al modelo 'User')
  assignedTo: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Historial de cambios (Requerido para "mantener un historial")
  // (Esta era una referencia a requisitos del proyecto)
  // Decidí guardar un array de sub-documentos aquí mismo.
  history: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' }, // Quién hizo el cambio
    action: String, // Qué hizo (ej. "Proceso Creado", "Proceso Aprobado")
    timestamp: { type: Date, default: Date.now } // Cuándo lo hizo
  }]
}, { 
  timestamps: true // Agrega createdAt y updatedAt
});

// Exporto el modelo 'Process'
module.exports = mongoose.model('Process', processSchema);