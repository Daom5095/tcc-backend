/*
 * Rutas de Procesos (/api/processes).
 * Este es el archivo MÁS IMPORTANTE. Maneja la creación,
 * asignación, y gestión de procesos e incidencias.
 */
const express = require('express');
const Joi = require('joi');
const router = express.Router();
const mongoose = require('mongoose'); // Importo mongoose para validar ObjectIDs

// Middlewares
const authMiddleware = require('../middlewares/auth'); // Para proteger rutas
const checkRole = require('../middlewares/checkRole'); // Para restringir por rol

// Modelos
const Process = require('../models/Process');
const Incident = require('../models/Incident');
const User = require('../models/User'); // Lo uso para buscar al revisor por email

/* =========================================================
   🧩 VALIDACIONES DE DATOS CON JOI
   ========================================================= */

// Esquema para crear un NUEVO PROCESO
const createProcessSchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  description: Joi.string().max(1000).allow(''), // Descripción opcional
  assignedToEmail: Joi.string().email({ tlds: false }).required().messages({
     'string.email': 'Debe ingresar un correo válido para el revisor'
  })
});

// Esquema para reportar una NUEVA INCIDENCIA
const createIncidentSchema = Joi.object({
  description: Joi.string().min(10).required(), // Descripción obligatoria
  severity: Joi.string().valid('baja', 'media', 'critica').required(),
  // --- MEJORA: Hacemos la evidencia opcional (texto) ---
  evidence: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('texto', 'imagen', 'enlace').required(),
      content: Joi.string().required()
    })
  ).min(0).optional() // Puede ser un array vacío
});

/* =========================================================
   🔑 (ADMIN/SUPERVISOR) Crear nuevo proceso
   POST /api/processes/
   ========================================================= */
// Protegido por auth y restringido a 'admin' o 'supervisor'
router.post('/', authMiddleware, checkRole(['admin', 'supervisor']), async (req, res) => {
  try {
    // 1. Validar la entrada
    const { error } = createProcessSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { title, description, assignedToEmail } = req.body;
    
    // 2. Buscar al usuario 'revisor' al que se le asignará
    const revisor = await User.findOne({ email: assignedToEmail, role: 'revisor' });
    if (!revisor) {
      return res.status(404).json({ message: 'Usuario revisor no encontrado con ese email' });
    }
    
    // 3. Crear el nuevo proceso
    const newProcess = new Process({
      title,
      description,
      createdBy: req.user.id, // El supervisor/admin que lo está creando
      assignedTo: revisor._id, // El revisor encontrado
      history: [{ user: req.user.id, action: 'Proceso Creado' }] // Historial
    });

    await newProcess.save();
    
    // 4. ¡NOTIFICACIÓN EN TIEMPO REAL!
    // Obtengo la instancia de 'io' que guardé en server.js
    const io = req.app.get('io');
    const notificationPayload = {
        id: newProcess._id,
        title: newProcess.title,
        message: `Te han asignado un nuevo proceso: "${newProcess.title}"`
    };
    // Emito el evento 'process:assigned' SOLO a la sala privada del revisor
    io.to(revisor._id.toString()).emit('process:assigned', notificationPayload);

    // --- MEJORA: Populamos los datos antes de devolverlo ---
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
   👤 (TODOS) Obtener listado de procesos
   GET /api/processes/
   ========================================================= */
// Protegido por auth (todos los roles logueados pueden verlo)
router.get('/', authMiddleware, async (req, res) => {
  try {
    let processes = [];
    const { role, id } = req.user; // Datos del usuario que hace la petición

    // 1. Lógica de filtrado basada en ROL
    if (role === 'revisor') {
      // El revisor ve solo los procesos que se le asignaron a ÉL
      processes = await Process.find({ assignedTo: id })
        .populate({ path: 'createdBy', select: 'name email' }) // Muestro quién lo creó
        .sort({ createdAt: -1 });
    } else {
      // Admin y Supervisor ven los procesos que ELLOS crearon
      processes = await Process.find({ createdBy: id })
        .populate({ path: 'assignedTo', select: 'name email' }) // Muestro a quién se asignó
        .sort({ createdAt: -1 });
    }
    
    res.json(processes);
  } catch (err) {
    console.error('Error en GET /api/processes:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


// ---
// --- ¡NUEVA RUTA! ---
// ---
/* =========================================================
   📄 (TODOS) Obtener detalle de UN proceso
   GET /api/processes/:id
   ========================================================= */
// Esta ruta es crucial para la página de detalle
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de proceso no válido' });
    }

    // 1. Buscar el proceso
    const process = await Process.findById(id)
                          .populate({ path: 'createdBy', select: 'name email' })
                          .populate({ path: 'assignedTo', select: 'name email' });

    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }

    // 2. ¡SEGURIDAD! Verificar que el usuario tenga permiso
    // El Revisor solo puede ver si está asignado a él
    // El Supervisor/Admin solo puede ver si lo creó él
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


// ---
// --- ¡NUEVA RUTA! ---
// ---
/* =========================================================
   (TODOS) Obtener incidencias de UN proceso
   GET /api/processes/:id/incidents
   ========================================================= */
// Esta ruta es crucial para la página de detalle
router.get('/:id/incidents', authMiddleware, async (req, res) => {
  try {
    const { id: processId } = req.params;
    const { role, id: userId } = req.user;

    // 1. Verifico que el proceso exista Y que yo tenga permiso
    // (Reutilizo la lógica de la ruta anterior)
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
    
    // 2. Si tengo permiso, busco las incidencias
    const incidents = await Incident.find({ processId: processId })
                              .populate({ path: 'reportedBy', select: 'name email' })
                              .sort({ createdAt: 'desc' }); // Muestro las más nuevas primero
    
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
// Protegido por auth y restringido a 'revisor'
router.post('/:id/incidents', authMiddleware, checkRole(['revisor']), async (req, res) => {
  try {
    // 1. Validar los datos de la incidencia
    const { error } = createIncidentSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const processId = req.params.id; // ID del proceso
    const { description, severity, evidence } = req.body;
    
    // 2. Verificar que el proceso exista Y esté asignado a este revisor
    const process = await Process.findOne({ _id: processId, assignedTo: req.user.id });
    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado o no asignado a este usuario' });
    }

    // 3. Crear la nueva incidencia
    const newIncident = new Incident({
      processId,
      reportedBy: req.user.id,
      description,
      severity,
      evidence: evidence || [] // Aseguro que sea un array
    });
    
    await newIncident.save();
    
    // 4. Actualizar estado del proceso a "en revisión" si estaba "pendiente"
    if (process.status === 'pendiente') {
      process.status = 'en_revision';
      process.history.push({ user: req.user.id, action: 'Primera incidencia reportada' });
      await process.save();
    }
    
    // 5. ¡NOTIFICACIÓN EN TIEMPO REAL!
    const io = req.app.get('io');
    const notificationPayload = {
        id: newIncident._id,
        processId: process._id,
        processTitle: process.title,
        message: `${req.user.name} reportó una incidencia ${severity} en "${process.title}"`,
        severity: severity
    };
    // Enviar al supervisor/creador del proceso
    io.to(process.createdBy.toString()).emit('incident:created', notificationPayload);
    
    // --- MEJORA: Populo los datos antes de devolver ---
    const populatedIncident = await Incident.findById(newIncident._id)
                                    .populate({ path: 'reportedBy', select: 'name email' });

    res.status(201).json(populatedIncident);
  } catch (err) {
    console.error('Error en POST /api/processes/:id/incidents:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   (SUPERVISOR/ADMIN) Aprobar/Rechazar un proceso
   PUT /api/processes/:id/status
   ========================================================= */
// Protegido por auth y restringido a 'supervisor' o 'admin'
router.put('/:id/status', authMiddleware, checkRole(['supervisor', 'admin']), async (req, res) => {
    try {
        // 1. Validar que el estado sea uno de los permitidos
        const { status } = req.body;
        if (!['aprobado', 'rechazado'].includes(status)) {
            return res.status(400).json({ message: 'Estado no válido' });
        }

        const processId = req.params.id;
        
        // 2. El supervisor solo puede aprobar procesos que él creó
        const process = await Process.findOne({ _id: processId, createdBy: req.user.id });
        if (!process) {
            return res.status(404).json({ message: 'Proceso no encontrado o usted no es el creador' });
        }
        
        // 3. Actualizar el estado y el historial
        process.status = status;
        process.history.push({ user: req.user.id, action: `Proceso ${status}` });
        await process.save();
        
        // 4. ¡NOTIFICACIÓN EN TIEMPO REAL!
        const io = req.app.get('io');
        const notificationPayload = {
            id: process._id,
            title: process.title,
            status: process.status,
            message: `El proceso "${process.title}" ha sido ${status}`
        };
        // Enviar al revisor asignado
        io.to(process.assignedTo.toString()).emit('process:status_updated', notificationPayload);

        // --- MEJORA: Populo los datos antes de devolver ---
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