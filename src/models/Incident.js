/*
 * Modelo de datos para la Incidencia (Incident).
 * Representa un reporte (ej. un problema, una observación) que un 'revisor'
 * crea y asocia a un 'Proceso' específico.
 * Define la estructura de la colección 'incidents'.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;


const incidentSchema = new Schema({
  // A qué proceso pertenece esta incidencia (Relación con 'Process')
  processId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Process', 
    required: true 
  },
  // Quién reportó la incidencia (un 'revisor', relación con 'User')
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
    // 'texto', 'enlace', o 'archivo' (para imágenes/PDFs subidos)
    type: { 
      type: String, 
      enum: ['texto', 'imagen', 'enlace', 'archivo'], // 'archivo' fue clave
      default: 'texto' 
    },
    content: { // El texto (si es 'texto') o el nombre del archivo (si es 'archivo')
      type: String, 
      required: true 
    },
    url: { // Aquí guardo la ruta del archivo subido o el enlace externo
      type: String 
    }
  }],
  
  // Para el requisito de "incidencia crítica" 
  severity: {
    type: String,
    enum: ['baja', 'media', 'critica'],
    default: 'media'
  },
  
  // Un booleano simple para saber si el supervisor ya gestionó esto
  // (Aunque no lo implementé mucho en la lógica de rutas)
  resolved: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

// Exporto el modelo 'Incident'
module.exports = mongoose.model('Incident', incidentSchema);