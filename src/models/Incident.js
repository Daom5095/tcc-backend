/*
 * Modelo de datos para la Incidencia (Incident).
 * Representa un reporte (ej. un problema, una observación) que un 'revisor'
 * crea y asocia a un 'Proceso' específico.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;


const incidentSchema = new Schema({
  // A qué proceso pertenece esta incidencia
  processId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Process', 
    required: true 
  },
  // Quién reportó la incidencia (un 'revisor')
  reportedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  description: { 
    type: String, 
    required: true 
  },
  
  // "evidencia (texto, imágenes, enlaces)" 
  // Almaceno un array de evidencias.
  evidence: [{
    // 'texto', 'imagen' (guardo URL), 'enlace' (guardo URL)
    type: { 
      type: String, 
      enum: ['texto', 'imagen', 'enlace'], 
      default: 'texto' 
    },
    content: { 
      type: String, 
      required: true 
    }
  }],
  
  // Para el requisito de "incidencia crítica" 
  severity: {
    type: String,
    enum: ['baja', 'media', 'critica'],
    default: 'media'
  },
  
  // Un booleano simple para saber si el supervisor ya gestionó esto
  resolved: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

// Exporto el modelo
module.exports = mongoose.model('Incident', incidentSchema);