/*
 * Rutas de Procesos (/api/processes).
 * --- ¡MODIFICADO PARA GUARDAR NOTIFICACIONES (FASE 2 - PASO 1)! ---
 * --- ¡MODIFICADO CON VALIDACIÓN DE ARCHIVOS (MEJORA)! ---
 * --- ¡CORREGIDO: Creación automática de la carpeta 'uploads' (BUG FIX)! ---
 */
const express = require('express');
const Joi = require('joi');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer'); // Para manejar la subida de archivos (form-data)
const path = require('path');
const fs = require('fs'); // <-- ¡NUEVA IMPORTACIÓN!

// --- Middlewares ---
const authMiddleware = require('../middlewares/auth'); // Siempre primero
const checkRole = require('../middlewares/checkRole'); // Para rutas de admin/supervisor

// --- Modelos ---
const Notification = require('../models/Notification'); // Para guardar notificaciones en BD
const Process = require('../models/Process');
const Incident = require('../models/Incident');
const User = require('../models/User');


/* =========================================================
   🧩 VALIDACIONES DE DATOS CON JOI
   ========================================================= */

// Esquema para validar la creación de un nuevo proceso
const createProcessSchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  description: Joi.string().max(1000).allow(''), // allow('') permite descripciones vacías
  assignedToEmail: Joi.string().email({ tlds: false }).required().messages({
     'string.email': 'Debe ingresar un correo válido para el revisor'
  })
});

/* =========================================================
   💾 CONFIGURACIÓN DE MULTER (Subida de Archivos)
   ========================================================= */

// --- ¡INICIO DE LA CORRECCIÓN! ---
// Defino la ruta de 'uploads' en una variable
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// 1. Configuración de Almacenamiento (DiskStorage)
const storage = multer.diskStorage({
  // 'destination': dónde se guardan los archivos
  destination: function (req, file, cb) {
    // AÑADIDO: Verifico si la carpeta existe, si no, la creo
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  // 'filename': qué nombre tendrá el archivo en el servidor
  filename: function (req, file, cb) {
    // Creo un nombre único para evitar colisiones:
    // timestamp + random + nombre_original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
// --- FIN DE LA CORRECCIÓN ---


// 2. Filtro de Archivos (Mejora de seguridad)
const fileFilter = (req, file, cb) => {
  // Defino los mimetypes (tipos de archivo) que permito
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Aceptar archivo
  } else {
    // Rechazar archivo con un error específico
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan JPEG, PNG o PDF.'), false);
  }
};

// 3. Inicialización de Multer
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5 // Límite de 5MB por archivo
  },
  fileFilter: fileFilter // Aplico mi filtro de tipos
  // .array('evidenceFiles', 5) significa:
  // - Busca archivos en un campo llamado 'evidenceFiles' en el form-data
  // - Acepta un máximo de 5 archivos en esa petición.
}).array('evidenceFiles', 5);


/* =========================================================
   🔑 (ADMIN/SUPERVISOR) Crear nuevo proceso
   POST /api/processes/
   ========================================================= */
// Protegido por auth y rol
router.post('/', authMiddleware, checkRole(['admin', 'supervisor']), async (req, res) => {
  try {
    // 1. Validar datos del body
    const { error } = createProcessSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { title, description, assignedToEmail } = req.body;
    
    // 2. Buscar al revisor por email
    const revisor = await User.findOne({ email: assignedToEmail, role: 'revisor' });
    if (!revisor) {
      return res.status(404).json({ message: 'Usuario revisor no encontrado con ese email' });
    }
    
    // 3. Crear el nuevo proceso
    const newProcess = new Process({
      title,
      description,
      createdBy: req.user.id, // El creador soy YO (del token)
      assignedTo: revisor._id,
      // Añado el primer evento al historial
      history: [{ user: req.user.id, action: 'Proceso Creado' }]
    });

    await newProcess.save();
    
    // --- Lógica de Sockets y Notificaciones ---
    
    // 4. Obtengo la instancia de 'io' (que guardé en server.js)
    const io = req.app.get('io');
    const message = `Te han asignado un nuevo proceso: "${newProcess.title}"`;
    
    // 5. NUEVO: Guardo la notificación en la BD
    const newNotification = new Notification({
      user: revisor._id, // El destinatario es el revisor
      message: message,
      link: `/process/${newProcess._id}`, // Link para el frontend
      type: 'process'
    });
    await newNotification.save();
    
    // 6. Envío el evento de socket
    // Emito el evento 'process:assigned' SOLO a la sala personal del revisor
    // (la sala tiene el mismo nombre que su ID de usuario)
    io.to(revisor._id.toString()).emit('process:assigned', newNotification.toObject());

    // 7. Devuelvo el proceso creado (con datos populados)
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
// Protegida por auth
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role, id } = req.user; // Mis datos del token
    
    // Parámetros de Paginación y Filtro (Query Params)
    // ej: /api/processes?page=1&limit=9&status=pendiente&search=reporte
    const { status, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit; // Cuántos documentos saltar

    // 1. Construyo la query de MongoDB
    let query = {};

    // Regla de negocio:
    if (role === 'revisor') {
      // Un revisor SOLO ve procesos asignados a él
      query.assignedTo = id;
    } else if (role === 'supervisor') {
      // Un admin/supervisor SOLO ve procesos creados por él
      query.createdBy = id;
    }
    // Si es 'admin', la query se queda vacía {} y ve todo
    
    // 2. Añado filtros si existen
    if (status && status !== 'todos') {
      query.status = status;
    }
    if (search) {
      // Búsqueda por título (insensible a mayúsculas)
      query.title = { $regex: search, $options: 'i' };
    }

    // 3. Ejecuto las queries
    // Cuento el total de documentos (para la paginación)
    const totalProcesses = await Process.countDocuments(query);
    // Busco los procesos de la página actual
    const processes = await Process.find(query)
      .populate({ path: 'createdBy', select: 'name email' })
      .populate({ path: 'assignedTo', select: 'name email' })
      .sort({ createdAt: -1 }) // Los más nuevos primero
      .skip(skip)
      .limit(limit);
    
    // 4. Devuelvo la respuesta paginada
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
// Protegida por auth
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params; // ID del proceso
    const { role, id: userId } = req.user; // Mis datos

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de proceso no válido' });
    }

    // 1. Busco el proceso y populo los datos del creador y asignado
    const process = await Process.findById(id)
                          .populate({ path: 'createdBy', select: 'name email' })
                          .populate({ path: 'assignedTo', select: 'name email' });

    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }

    // 2. Verifico permisos (Regla de negocio)
    const isAssignedTo = process.assignedTo._id.toString() === userId;
    const isCreatedBy = process.createdBy._id.toString() === userId;

    if (role === 'revisor' && !isAssignedTo) {
      return res.status(403).json({ message: 'Acceso denegado: No eres el revisor' });
    }
    // REGLA MEJORADA: Un 'admin' puede ver todo.
    // Un 'supervisor' solo puede ver los que él creó.
    if (role === 'supervisor' && !isCreatedBy) {
       // Si soy supervisor y no lo cree yo
       return res.status(403).json({ message: 'Acceso denegado: No eres el creador de este proceso' });
    }

    // 3. Si paso los permisos, devuelvo el proceso
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
// Protegida por auth
router.get('/:id/incidents', authMiddleware, async (req, res) => {
  try {
    const { id: processId } = req.params;
    const { role, id: userId } = req.user;

    // 1. Verifico que el proceso exista
    const process = await Process.findById(processId);
    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }
    
    // 2. Verifico permisos (la misma lógica que para ver el detalle del proceso)
    const isAssignedTo = process.assignedTo.toString() === userId;
    const isCreatedBy = process.createdBy.toString() === userId;

    if (role === 'revisor' && !isAssignedTo) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    // REGLA MEJORADA: Un 'admin' puede ver todo.
    if (role === 'supervisor' && !isCreatedBy) {
       return res.status(403).json({ message: 'Acceso denegado' });
    }
    
    // 3. Busco las incidencias de ESE proceso
    const incidents = await Incident.find({ processId: processId })
                              .populate({ path: 'reportedBy', select: 'name email' })
                              .sort({ createdAt: 'desc' }); // Las más nuevas primero
    
    res.json(incidents);

  } catch (err) {
    console.error('Error en GET /api/processes/:id/incidents:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


// --- ¡NUEVA MEJORA! Middleware para manejar errores de Multer ---
// Este es un middleware personalizado que envuelve a 'upload' (de multer)
// para atrapar errores de tamaño o tipo de archivo antes de que lleguen a mi lógica.
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Error de Multer (ej. tamaño de archivo)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Error: El archivo es demasiado grande (Máx. 5MB).' });
      }
      return res.status(400).json({ message: `Error de Multer: ${err.message}` });
    } else if (err) {
      // Otro error (ej. tipo de archivo no permitido del fileFilter O el ENOENT)
      return res.status(400).json({ message: err.message });
    }
    // Si todo está bien, pasa al siguiente handler (la lógica de la ruta)
    next();
  });
};


/* =========================================================
   (REVISOR) Reportar una incidencia para un proceso
   POST /api/processes/:id/incidents
   ========================================================= */
// Esta ruta es compleja:
// 1. Protegida por auth (solo revisor)
// 2. Usa 'handleUpload' para procesar los archivos (form-data)
// 3. Guarda la incidencia
// 4. Emite un socket al supervisor
router.post(
  '/:id/incidents', 
  authMiddleware, // 1. Verifica token
  checkRole(['revisor']), // 2. Verifica rol (MEJORA: el código original no tenía esto, pero debería)
  handleUpload, // 3. Procesa archivos (y atrapa errores de Multer)
  async (req, res) => {
    try {
      // 4. Obtengo datos del body (form-data)
      const { description, severity, evidenceText, evidenceLink } = req.body;
      
      // 5. Validaciones manuales
      if (!description || description.length < 10) {
        return res.status(400).json({ message: 'La descripción debe tener al menos 10 caracteres' });
      }
      if (!['baja', 'media', 'critica'].includes(severity)) {
        return res.status(400).json({ message: 'La severidad no es válida' });
      }

      const processId = req.params.id;
      
      // 6. Verifico que el proceso exista Y esté asignado a MÍ
      const process = await Process.findOne({ _id: processId, assignedTo: req.user.id });
      if (!process) {
        return res.status(404).json({ message: 'Proceso no encontrado o no asignado a este usuario' });
      }
      // (Doble check de rol, aunque checkRole ya lo haría)
      if (req.user.role !== 'revisor') {
        return res.status(403).json({ message: 'Solo el revisor asignado puede reportar incidencias' });
      }

      // 7. Construyo el array de 'evidence'
      const evidencePayload = [];
      if (evidenceText) {
        evidencePayload.push({ type: 'texto', content: evidenceText });
      }
      if (evidenceLink) {
        evidencePayload.push({ type: 'enlace', content: evidenceLink, url: evidenceLink });
      }
      // 'req.files' es poblado por Multer (handleUpload)
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          evidencePayload.push({
            type: 'archivo', // Tipo 'archivo'
            content: file.originalname, // Guardo el nombre original
            url: `/uploads/${file.filename}` // Guardo la ruta donde se sirvió
          });
        });
      }

      // 8. Creo la nueva incidencia
      const newIncident = new Incident({
        processId,
        reportedBy: req.user.id,
        description,
        severity,
        evidence: evidencePayload
      });
      
      await newIncident.save();
      
      // 9. Lógica de negocio: Si es la primera incidencia,
      //    cambio el estado del Proceso a 'en_revision'.
      let processUpdated = false;
      if (process.status === 'pendiente') {
        process.status = 'en_revision';
        process.history.push({ user: req.user.id, action: 'Primera incidencia reportada' });
        await process.save();
        processUpdated = true;
      }
      
      // 10. --- Lógica de Sockets y Notificaciones ---
      const io = req.app.get('io');
      const populatedIncident = await Incident.findById(newIncident._id)
                                      .populate({ path: 'reportedBy', select: 'name email' });
      
      const message = `${req.user.name} reportó una incidencia ${severity} en "${process.title}"`;

      // 11. NUEVO: Guardo notificación en BD
      const newNotification = new Notification({
        user: process.createdBy, // Notificación para el CREADOR del proceso
        message: message,
        link: `/process/${process._id}`,
        type: 'incident'
        // 'severity' no se guardó aquí, pero podría añadirse al modelo Notification
      });
      await newNotification.save();

      // 12. Emito el evento al supervisor/creador
      io.to(process.createdBy.toString()).emit('incident:created', newNotification.toObject());
      
      // 13. Si el estado del proceso cambió, emito OTRO evento
      //     para actualizar el dashboard de todos (ej. el admin)
      if (processUpdated) {
        // (Este 'io.emit' global no estaba en el código, pero sería una buena práctica)
        // io.emit('process:status_updated', ...);
      }

      // 14. Devuelvo la incidencia creada
      res.status(201).json(populatedIncident);
    } catch (err) {
      console.error('Error en POST /api/processes/:id/incidents:', err);
      // ¡Aquí estaba el error! El 'err.message' es el ENOENT.
      // Lo cambiamos por un mensaje genérico para que el 'errorHandler' no lo tome
      res.status(500).json({ message: 'Error interno del servidor al guardar la incidencia' });
    }
  }
);

/* =========================================================
   (SUPERVISOR/ADMIN) Aprobar/Rechazar un proceso
   PUT /api/processes/:id/status
   ========================================================= */
// Protegido por auth y rol
router.put('/:id/status', authMiddleware, checkRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { status } = req.body;
        // 1. Valido que el estado sea uno de los finales
        if (!['aprobado', 'rechazado'].includes(status)) {
            return res.status(400).json({ message: 'Estado no válido' });
        }

        const processId = req.params.id;
        
        // 2. Busco el proceso Y me aseguro que yo sea el creador
        const process = await Process.findOne({ _id: processId, createdBy: req.user.id });
        if (!process) {
            // Si no lo encontré, reviso si soy admin (los admin pueden aprobar/rechazar todo)
            if (req.user.role === 'admin') {
              const adminProcess = await Process.findById(processId);
              if (!adminProcess) {
                return res.status(404).json({ message: 'Proceso no encontrado' });
              }
              // Si soy admin y existe, lo uso
              process = adminProcess;
            } else {
              // Si soy supervisor y no es mío, bloqueo
              return res.status(404).json({ message: 'Proceso no encontrado o usted no es el creador' });
            }
        }
        
        // 3. Actualizo el estado y el historial
        process.status = status;
        process.history.push({ user: req.user.id, action: `Proceso ${status}` });
        await process.save();
        
        // 4. --- Lógica de Sockets y Notificaciones ---
        const io = req.app.get('io');
        const message = `El proceso "${process.title}" ha sido ${status}`;
        
        // 5. NUEVO: Guardo notificación en BD
        const newNotification = new Notification({
          user: process.assignedTo, // Notificación para el REVISOR asignado
          message: message,
          link: `/process/${process._id}`,
          type: 'process'
        });
        await newNotification.save();
        
        // 6. Emito el evento al revisor
        io.to(process.assignedTo.toString()).emit('process:status_updated', newNotification.toObject());

        // 7. Devuelvo el proceso actualizado y populado
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