/*
 * Rutas de Usuarios (/api/users).
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole'); 
const User = require('../models/User');
const Joi = require('joi');
const bcrypt = require('bcrypt');

/* =========================================================
   👥 OBTENER LISTA DE USUARIOS (Para Chat y Asignar Procesos)
   GET /api/users/
   ========================================================= */
// Protegida por auth (debes estar logueado para ver otros usuarios)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id; // Mi ID (del token)
    
    // Creamos una query base
    const query = {
      _id: { $ne: myId }, // Excluirme a mí mismo
      isActive: true      // Solo usuarios activos
    };

    // Si el frontend envía ?role=revisor, filtramos por rol
    if (req.query.role) {
      query.role = req.query.role;
    }

    // Devuelve solo usuarios ACTIVOS que no sean yo
    const users = await User.find(query)
                            .select('name email role'); // Solo devuelvo estos campos
    
    res.json(users);

  } catch (err) {
    console.error('Error en GET /api/users:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   👤 ACTUALIZAR MI PERFIL (Nombre)
   PUT /api/users/me
   ========================================================= */
// Esquema de validación para el perfil
const profileSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    'string.empty': 'El nombre es obligatorio',
    'string.min': 'El nombre debe tener al menos 3 caracteres',
  }),
});

// Protegida por auth
router.put('/me', authMiddleware, async (req, res) => {
  try {
    // 1. Validar la entrada
    const { error } = profileSchema.validate(req.body);
    if (error)
      return res.status(400).json({ message: error.details[0].message });
      
    const { name } = req.body;
    
    // 2. Buscar y actualizar MI usuario (ID del token)
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name: name } },
      { new: true } // {new: true} me devuelve el documento actualizado
    ).select('-passwordHash'); // Excluyo el hash

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // 3. Devuelvo el usuario actualizado
    res.json(updatedUser);

  } catch (err) {
    console.error('Error en PUT /api/users/me:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   🔑 ACTUALIZAR MI CONTRASEÑA
   PUT /api/users/me/password
   ========================================================= */
// Esquema de validación para la contraseña
const passwordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'La contraseña actual es obligatoria',
  }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.min': 'La nueva contraseña debe tener al menos 6 caracteres',
    'string.empty': 'La nueva contraseña es obligatoria',
  }),
});

// Protegida por auth
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    // 1. Validar
    const { error } = passwordSchema.validate(req.body);
    if (error)
      return res.status(400).json({ message: error.details[0].message });
      
    const { currentPassword, newPassword } = req.body;
    
    // 2. Busco mi usuario (esta vez necesito el hash, así que no uso .select)
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // 3. Verifico si la contraseña actual es correcta
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    }
    
    // 4. Hasheo la nueva contraseña y la guardo
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newPasswordHash;
    await user.save(); // Guardo el documento
    
    res.json({ message: 'Contraseña actualizada exitosamente' });

  } catch (err) {
    console.error('Error en PUT /api/users/me/password:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


/* =========================================================
   --- INICIO DE RUTAS DE ADMIN ---
   (Estas rutas están protegidas por auth Y por checkRole(['admin']))
   ========================================================= */

/* =========================================================
   👑 (ADMIN) OBTENER TODOS LOS USUARIOS
   GET /api/users/admin/all
   ========================================================= */
router.get('/admin/all', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    // 1. Busco TODOS los usuarios (incluidos inactivos y yo mismo)
    const users = await User.find()
                            .select('-passwordHash')
                            .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('Error en GET /api/users/admin/all:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   👑 (ADMIN) ACTUALIZAR ROL DE UN USUARIO
   PUT /api/users/admin/:id/role
   ========================================================= */
const roleSchema = Joi.object({
  role: Joi.string().valid('revisor', 'supervisor', 'admin').required(),
});

router.put('/admin/:id/role', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params; // ID del usuario a modificar
    
    // 1. Validar el rol enviado
    const { error } = roleSchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'Rol no válido' });
    
    const { role } = req.body;
    
    // 2. Regla de negocio: Un admin no puede cambiarse el rol a sí mismo
    if (id === req.user.id) {
      return res.status(403).json({ message: 'No puedes cambiar tu propio rol' });
    }
    
    // 3. Buscar y actualizar al usuario por su ID
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: { role: role } },
      { new: true }
    ).select('-passwordHash');
    
    if (!updatedUser) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(updatedUser);
  } catch (err) {
    console.error('Error en PUT /api/users/admin/:id/role:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   👑 (ADMIN) ACTIVAR/DESACTIVAR UN USUARIO
   PUT /api/users/admin/:id/status
   ========================================================= */
const statusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

router.put('/admin/:id/status', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params; // ID del usuario a modificar
    
    // 1. Validar el estado enviado
    const { error } = statusSchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'Estado no válido' });
    
    const { isActive } = req.body;
    
    // 2. Regla de negocio: Un admin no puede desactivarse a sí mismo
    if (id === req.user.id) {
      return res.status(403).json({ message: 'No puedes desactivar tu propia cuenta' });
    }
    
    // 3. Buscar y actualizar
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: isActive } },
      { new: true }
    ).select('-passwordHash');
    
    if (!updatedUser) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(updatedUser);
  } catch (err) {
    console.error('Error en PUT /api/users/admin/:id/status:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;