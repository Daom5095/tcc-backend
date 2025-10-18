const mongoose = require('mongoose');
const { Schema } = mongoose;

const processSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pendiente', 'en_revision', 'aprobado', 'rechazado'],
    default: 'pendiente'
  },
  // Quién creó/supervisa este proceso
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // A quién se le asignó la revisión
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Historial de cambios (opcional pero recomendado por el PDF)
  history: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    action: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Asegúrate de que esta línea esté exactamente así:
module.exports = mongoose.model('Process', processSchema);