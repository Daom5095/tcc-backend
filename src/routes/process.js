/*
 * Rutas de Procesos (/api/processes).
 * --- ¡MODIFICADO PARA QUITAR LÍMITE DE ARCHIVOS (MEJORA)! ---
 */
const express = require('express');
const Joi = require('joi');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');

// --- Middlewares ---
const authMiddleware = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole'); 

// --- Modelos ---
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
  assignedToId: Joi.string().required().messages({
     'string.empty': 'Debe seleccionar un revisor'
  })
});

/* =========================================================
   💾 CONFIGURACIÓN DE MULTER (Subida de Archivos)
   ========================================================= */

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan JPEG, PNG o PDF.'), false);
  }
};

// 3. Inicialización de Multer
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5 // Mantenemos el límite de 5MB *por archivo*
  },
  fileFilter: fileFilter
  // --- ¡INICIO DE CAMBIO! ---
  // Quitamos el número 5 de .array() para permitir archivos ilimitados
}).array('evidenceFiles'); 
// --- ¡FIN DE CAMBIO! ---


/* =========================================================
   🔑 (ADMIN/SUPERVISOR) Crear nuevo proceso
   POST /api/processes/
   ========================================================= */
router.post('/', authMiddleware, checkRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const { error } = createProcessSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { title, description, assignedToId } = req.body;
    
    const revisor = await User.findOne({ _id: assignedToId, role: 'revisor' });
    if (!revisor) {
      return res.status(404).json({ message: 'Usuario revisor no encontrado' });
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
    
    const newNotification = new Notification({
      user: revisor._id,
      message: message,
      link: `/process/${newProcess._id}`,
      type: 'process'
    });
    await newNotification.save();
    
    io.to(revisor._id.toString()).emit('process:assigned', newNotification.toObject());

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
   (Rutas GET /api/processes/ y GET /api/processes/:id no cambian)
   ...
   ========================================================= */

/* =========================================================
   👤 (TODOS) Obtener listado de procesos (CON PAGINACIÓN)
   ========================================================= */
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
    } else if (role === 'supervisor') {
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
   ========================================================= */
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
      return res.status(403).json({ message: 'Acceso denegado: No eres el revisor' });
    }
    if (role === 'supervisor' && !isCreatedBy) {
       return res.status(403).json({ message: 'Acceso denegado: No eres el creador de este proceso' });
    }

    res.json(process);

  } catch (err) {
    console.error('Error en GET /api/processes/:id:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


/* =========================================================
   (TODOS) Obtener incidencias de UN proceso
   ========================================================= */
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
    if (role === 'supervisor' && !isCreatedBy) {
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


// Middleware para manejar errores de Multer
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Error: El archivo es demasiado grande (Máx. 5MB).' });
      }
      // --- ¡INICIO DE CAMBIO! ---
      // Capturamos el error si se envían demasiados archivos (ahora que no hay límite, esto no debería pasar)
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Error: Se superó el límite de archivos.' });
      }
      // --- ¡FIN DE CAMBIO! ---
      return res.status(400).json({ message: `Error de Multer: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};


/* =========================================================
   (REVISOR) Reportar una incidencia para un proceso
   ========================================================= */
router.post(
  '/:id/incidents', 
  authMiddleware,
  checkRole(['revisor']),
  handleUpload, 
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

      const newNotification = new Notification({
        user: process.createdBy,
        message: message,
        link: `/process/${process._id}`,
        type: 'incident'
      });
      await newNotification.save();

      io.to(process.createdBy.toString()).emit('incident:created', newNotification.toObject());
      
      res.status(201).json(populatedIncident);
    } catch (err) {
      console.error('Error en POST /api/processes/:id/incidents:', err);
      res.status(500).json({ message: 'Error interno del servidor al guardar la incidencia' });
    }
  }
);

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
        
        let process;
        if (req.user.role === 'admin') {
          process = await Process.findById(processId);
        } else {
          process = await Process.findOne({ _id: processId, createdBy: req.user.id });
        }

        if (!process) {
            return res.status(404).json({ message: 'Proceso no encontrado o usted no tiene permisos' });
        }
        
        process.status = status;
        process.history.push({ user: req.user.id, action: `Proceso ${status}` });
        await process.save();
        
        const io = req.app.get('io');
        const message = `El proceso "${process.title}" ha sido ${status}`;
        
        const newNotification = new Notification({
          user: process.assignedTo, 
          message: message,
          link: `/process/${process._id}`,
          type: 'process'
        });
        await newNotification.save();
        
        io.to(process.assignedTo.toString()).emit('process:status_updated', newNotification.toObject());

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