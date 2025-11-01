/*
 * Rutas de Procesos (/api/processes).
 * --- ¡MODIFICADO PARA GUARDAR NOTIFICACIONES (FASE 2 - PASO 1)! ---
 */
const express = require('express');
const Joi = require('joi');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

// Middlewares
const authMiddleware = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

// Modelos
const Notification = require('../models/Notification');
const Process = require('../models/Process');
const Incident = require('../models/Incident');
const User = require('../models/User');


/* =========================================================
   🧩 VALIDACIONES DE DATOS CON JOI
   ========================================================= */

const createProcessSchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  description: Joi.string().max(1000).allow(''), 
  assignedToEmail: Joi.string().email({ tlds: false }).required().messages({
     'string.email': 'Debe ingresar un correo válido para el revisor'
  })
});

// --- Configuración de Multer ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

/* =========================================================
   🔑 (ADMIN/SUPERVISOR) Crear nuevo proceso
   POST /api/processes/
   ========================================================= */
router.post('/', authMiddleware, checkRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const { error } = createProcessSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { title, description, assignedToEmail } = req.body;
    
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
    
    const io = req.app.get('io');
    const message = `Te han asignado un nuevo proceso: "${newProcess.title}"`;
    
    // --- NUEVO: Guardar notificación en BD ---
    const newNotification = new Notification({
      user: revisor._id,
      message: message,
      link: `/process/${newProcess._id}`,
      type: 'process'
    });
    await newNotification.save();
    // --- Fin de guardar notificación ---
    
    const notificationPayload = {
        ...newNotification.toObject(), // <-- MODIFICADO: Envía el objeto de notificación
        id: newProcess._id, // Mantenemos ID para compatibilidad (si es necesario)
        title: newProcess.title,
    };
    
    io.to(revisor._id.toString()).emit('process:assigned', notificationPayload);

    const populatedProcess = await Process.findById(newProcess._id)
                                    .populate({ path: 'createdBy', select: 'name email' })
                                    .populate({ path: 'assignedTo', select: 'name email' });

    res.status(201).json(populatedProcess);
  } catch (err) {
    console.error('Error en POST /api/processes:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   👤 (TODOS) Obtener listado de procesos (CON PAGINACIÓN)
   GET /api/processes/
   ========================================================= */
// (Esta ruta no cambia)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role, id } = req.user;
    
    const { status, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    let query = {};

    if (role === 'revisor') {
      query.assignedTo = id;
    } else {
      query.createdBy = id;
    }
    if (status && status !== 'todos') {
      query.status = status;
    }
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const totalProcesses = await Process.countDocuments(query);
    const processes = await Process.find(query)
      .populate({ path: 'createdBy', select: 'name email' })
      .populate({ path: 'assignedTo', select: 'name email' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json({
      processes,
      total: totalProcesses,
      page: page,
      limit: limit
    });

  } catch (err) {
    console.error('Error en GET /api/processes:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


/* =========================================================
   📄 (TODOS) Obtener detalle de UN proceso
   GET /api/processes/:id
   ========================================================= */
// (Esta ruta no cambia)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de proceso no válido' });
    }

    const process = await Process.findById(id)
                          .populate({ path: 'createdBy', select: 'name email' })
                          .populate({ path: 'assignedTo', select: 'name email' });

    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }

    const isAssignedTo = process.assignedTo._id.toString() === userId;
    const isCreatedBy = process.createdBy._id.toString() === userId;

    if (role === 'revisor' && !isAssignedTo) {
      return res.status(403).json({ message: 'Acceso denegado a este proceso' });
    }
    if (role !== 'revisor' && !isCreatedBy) {
       return res.status(403).json({ message: 'Acceso denegado a este proceso' });
    }

    res.json(process);

  } catch (err) {
    console.error('Error en GET /api/processes/:id:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


/* =========================================================
   (TODOS) Obtener incidencias de UN proceso
   GET /api/processes/:id/incidents
   ========================================================= */
// (Esta ruta no cambia)
router.get('/:id/incidents', authMiddleware, async (req, res) => {
  try {
    const { id: processId } = req.params;
    const { role, id: userId } = req.user;

    const process = await Process.findById(processId);
    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }
    
    const isAssignedTo = process.assignedTo.toString() === userId;
    const isCreatedBy = process.createdBy.toString() === userId;

    if (role === 'revisor' && !isAssignedTo) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    if (role !== 'revisor' && !isCreatedBy) {
       return res.status(403).json({ message: 'Acceso denegado' });
    }
    
    const incidents = await Incident.find({ processId: processId })
                              .populate({ path: 'reportedBy', select: 'name email' })
                              .sort({ createdAt: 'desc' }); 
    
    res.json(incidents);

  } catch (err) {
    console.error('Error en GET /api/processes/:id/incidents:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


/* =========================================================
   (REVISOR) Reportar una incidencia para un proceso
   POST /api/processes/:id/incidents
   ========================================================= */
// --- RUTA MODIFICADA (Guarda Notificación) ---
router.post(
  '/:id/incidents', 
  authMiddleware, 
  upload.array('evidenceFiles', 5), 
  async (req, res) => {
    try {
      const { description, severity, evidenceText, evidenceLink } = req.body;
      if (!description || description.length < 10) {
        return res.status(400).json({ message: 'La descripción debe tener al menos 10 caracteres' });
      }
      if (!['baja', 'media', 'critica'].includes(severity)) {
        return res.status(400).json({ message: 'La severidad no es válida' });
      }

      const processId = req.params.id;
      
      const process = await Process.findOne({ _id: processId, assignedTo: req.user.id });
      if (!process) {
        return res.status(404).json({ message: 'Proceso no encontrado o no asignado a este usuario' });
      }
      if (req.user.role !== 'revisor') {
        return res.status(403).json({ message: 'Solo el revisor asignado puede reportar incidencias' });
      }

      const evidencePayload = [];
      if (evidenceText) {
        evidencePayload.push({ type: 'texto', content: evidenceText });
      }
      if (evidenceLink) {
        evidencePayload.push({ type: 'enlace', content: evidenceLink, url: evidenceLink });
      }
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          evidencePayload.push({
            type: 'archivo',
            content: file.originalname,
            url: `/uploads/${file.filename}`
          });
        });
      }

      const newIncident = new Incident({
        processId,
        reportedBy: req.user.id,
        description,
        severity,
        evidence: evidencePayload
      });
      
      await newIncident.save();
      
      let processUpdated = false;
      if (process.status === 'pendiente') {
        process.status = 'en_revision';
        process.history.push({ user: req.user.id, action: 'Primera incidencia reportada' });
        await process.save();
        processUpdated = true;
      }
      
      const io = req.app.get('io');
      const populatedIncident = await Incident.findById(newIncident._id)
                                      .populate({ path: 'reportedBy', select: 'name email' });
      
      const message = `${req.user.name} reportó una incidencia ${severity} en "${process.title}"`;

      // --- NUEVO: Guardar notificación en BD ---
      const newNotification = new Notification({
        user: process.createdBy, // Notificación para el creador del proceso
        message: message,
        link: `/process/${process._id}`,
        type: 'incident',
        severity: severity // Guardamos la severidad
      });
      await newNotification.save();
      // --- Fin de guardar notificación ---

      const notificationPayload = {
          ...newNotification.toObject(), // <-- MODIFICADO: Envía el objeto de notificación
          processTitle: process.title,
      };
      
      // Enviar al supervisor/creador del proceso
      io.to(process.createdBy.toString()).emit('incident:created', notificationPayload);
      
      if (processUpdated) {
        const populatedProcess = await Process.findById(process._id)
                                    .populate({ path: 'createdBy', select: 'name email' })
                                    .populate({ path: 'assignedTo', select: 'name email' });
        io.emit('process:status_updated', populatedProcess);
      }

      res.status(201).json(populatedIncident);
    } catch (err) {
      console.error('Error en POST /api/processes/:id/incidents:', err);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
);

/* =========================================================
   (SUPERVISOR/ADMIN) Aprobar/Rechazar un proceso
   PUT /api/processes/:id/status
   ========================================================= */
// --- RUTA MODIFICADA (Guarda Notificación) ---
router.put('/:id/status', authMiddleware, checkRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['aprobado', 'rechazado'].includes(status)) {
            return res.status(400).json({ message: 'Estado no válido' });
        }

        const processId = req.params.id;
        
        const process = await Process.findOne({ _id: processId, createdBy: req.user.id });
        if (!process) {
            return res.status(404).json({ message: 'Proceso no encontrado o usted no es el creador' });
        }
        
        process.status = status;
        process.history.push({ user: req.user.id, action: `Proceso ${status}` });
        await process.save();
        
        const io = req.app.get('io');
        const message = `El proceso "${process.title}" ha sido ${status}`;
        
        // --- NUEVO: Guardar notificación en BD ---
        const newNotification = new Notification({
          user: process.assignedTo, // Notificación para el revisor asignado
          message: message,
          link: `/process/${process._id}`,
          type: 'process'
        });
        await newNotification.save();
        // --- Fin de guardar notificación ---

        const notificationPayload = {
            ...newNotification.toObject(), // <-- MODIFICADO
            title: process.title,
            status: process.status,
        };
        // Enviar al revisor asignado
        io.to(process.assignedTo.toString()).emit('process:status_updated', notificationPayload);

        const populatedProcess = await Process.findById(process._id)
                                    .populate({ path: 'createdBy', select: 'name email' })
                                    .populate({ path: 'assignedTo', select: 'name email' });
        
        res.json(populatedProcess);
    } catch (err) {
        console.error('Error en PUT /api/processes/:id/status:', err);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


module.exports = router;