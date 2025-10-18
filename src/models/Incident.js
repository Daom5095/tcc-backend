const mongoose = require('mongoose');
const { Schema } = mongoose;


const incidentSchema = new Schema({
  // A qué proceso pertenece esta incidencia
  processId: { type: Schema.Types.ObjectId, ref: 'Process', required: true },
  // Quién reportó la incidencia
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  description: { type: String, required: true },
  
  // Para "evidencia (texto, imágenes, enlaces)"
  // Guardaremos las URLs o el texto de la evidencia
  evidence: [{
    type: { type: String, enum: ['texto', 'imagen', 'enlace'], default: 'texto' },
    content: { type: String, required: true }
  }],
  
  // Para "incidencia crítica"
  severity: {
    type: String,
    enum: ['baja', 'media', 'critica'],
    default: 'media'
  },
  
  resolved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Incident', incidentSchema);