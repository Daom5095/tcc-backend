const express = require('express');
const Joi = require('joi');
const router = express.Router();

// Middlewares
const authMiddleware = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

// Modelos
const Process = require('../models/Process');
const Incident = require('../models/Incident');
const User = require('../models/User'); // Para verificar que el 'revisor' exista

/* =========================================================
   🧩 VALIDACIONES DE DATOS CON JOI
   ========================================================= */
const createProcessSchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  description: Joi.string().max(1000).allow(''),
  assignedToEmail: Joi.string().email().required().messages({
     'string.email': 'Debe ingresar un correo válido para el revisor'
  })
});

const createIncidentSchema = Joi.object({
  description: Joi.string().min(10).required(),
  severity: Joi.string().valid('baja', 'media', 'critica').required(),
  evidence: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('texto', 'imagen', 'enlace').required(),
      content: Joi.string().required()
    })
  ).min(1).required() // Requerir al menos una evidencia
});

/* =========================================================
   🔑 (ADMIN/SUPERVISOR) Crear nuevo proceso
   ========================================================= */
router.post('/', authMiddleware, checkRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const { error } = createProcessSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { title, description, assignedToEmail } = req.body;
    
    // Buscar al usuario revisor por su email
    const revisor = await User.findOne({ email: assignedToEmail, role: 'revisor' });
    if (!revisor) {
      return res.status(404).json({ message: 'Usuario revisor no encontrado con ese email' });
    }
    
    const newProcess = new Process({
      title,
      description,
      createdBy: req.user.id,
      assignedTo: revisor._id,
      history: [{ user: req.user.id, action: 'Proceso Creado' }]
    });

    await newProcess.save();
    
    // TODO: Emitir evento de socket (ej. 'proceso_asignado') al 'revisor' (revisor._id)

    res.status(201).json(newProcess);
  } catch (err) {
    console.error('Error en POST /api/processes:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   👤 (TODOS) Obtener listado de procesos
   ========================================================= */
router.get('/', authMiddleware, async (req, res) => {
  try {
    let processes = [];
    const { role, id } = req.user;

    if (role === 'revisor') {
      // El revisor ve solo los procesos que se le asignaron
      processes = await Process.find({ assignedTo: id }).populate('createdBy', 'name email').sort({ createdAt: -1 });
    } else {
      // Admin y Supervisor ven los procesos que ellos crearon
      processes = await Process.find({ createdBy: id }).populate('assignedTo', 'name email').sort({ createdAt: -1 });
    }
    
    res.json(processes);
  } catch (err) {
    console.error('Error en GET /api/processes:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   (REVISOR) Reportar una incidencia para un proceso
   ========================================================= */
router.post('/:id/incidents', authMiddleware, checkRole(['revisor']), async (req, res) => {
  try {
    const { error } = createIncidentSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const processId = req.params.id;
    const { description, severity, evidence } = req.body;
    
    // Verificar que el proceso exista y esté asignado a este revisor
    const process = await Process.findOne({ _id: processId, assignedTo: req.user.id });
    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado o no asignado a este usuario' });
    }

    const newIncident = new Incident({
      processId,
      reportedBy: req.user.id,
      description,
      severity,
      evidence
    });
    
    await newIncident.save();
    
    // Actualizar estado del proceso a "en revisión" si estaba "pendiente"
    if (process.status === 'pendiente') {
      process.status = 'en_revision';
      process.history.push({ user: req.user.id, action: 'Primera incidencia reportada' });
      await process.save();
    }
    
    // ¡IMPORTANTE! Notificación en tiempo real
    // TODO: Emitir evento de socket (ej. 'incidencia_critica') al supervisor (process.createdBy)

    res.status(201).json(newIncident);
  } catch (err) {
    console.error('Error en POST /api/processes/:id/incidents:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   (SUPERVISOR/ADMIN) Aprobar/Rechazar un proceso
   ========================================================= */
router.put('/:id/status', authMiddleware, checkRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['aprobado', 'rechazado'].includes(status)) {
            return res.status(400).json({ message: 'Estado no válido' });
        }

        const processId = req.params.id;
        
        // El supervisor solo puede aprobar procesos que él creó
        const process = await Process.findOne({ _id: processId, createdBy: req.user.id });
        if (!process) {
            return res.status(404).json({ message: 'Proceso no encontrado o usted no es el creador' });
        }
        
        process.status = status;
        process.history.push({ user: req.user.id, action: `Proceso ${status}` });
        await process.save();
        
        // TODO: Emitir evento de socket (ej. 'proceso_aprobado') al revisor (process.assignedTo)

        res.json(process);
    } catch (err) {
        console.error('Error en PUT /api/processes/:id/status:', err);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


module.exports = router;