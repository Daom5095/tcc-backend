// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/User');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

/* =========================================================
   🧩 VALIDACIONES DE DATOS CON JOI
   ========================================================= */
const registerSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    'string.empty': 'El nombre es obligatorio',
    'string.min': 'El nombre debe tener al menos 3 caracteres',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Debe ingresar un correo válido',
    'any.required': 'El correo es obligatorio'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'La contraseña debe tener al menos 6 caracteres',
  }),
  role: Joi.string().valid('revisor', 'supervisor', 'admin')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Debe ingresar un correo válido',
    'any.required': 'El correo es obligatorio'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'La contraseña debe tener al menos 6 caracteres',
    'any.required': 'La contraseña es obligatoria'
  })
});

/* =========================================================
   📥 REGISTRO DE USUARIOS
   ========================================================= */
router.post('/register', async (req, res) => {
  try {
    // Validación con Joi
    const { error } = registerSchema.validate(req.body);
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const { name, email, password, role } = req.body;

    // Verificar duplicado
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: 'El usuario ya existe' });

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = new User({ name, email, passwordHash, role });
    await user.save();

    // Generar token JWT
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('Error en /register:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   🔐 LOGIN DE USUARIOS
   ========================================================= */
router.post('/login', async (req, res) => {
  try {
    // Validación con Joi
    const { error } = loginSchema.validate(req.body);
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;

    // Verificar usuario
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: 'Credenciales inválidas' });

    // Comparar contraseña
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(401).json({ message: 'Credenciales inválidas' });

    // Generar token
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   👤 OBTENER PERFIL DE USUARIO LOGUEADO
   ========================================================= */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user)
      return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json({ user });
  } catch (err) {
    console.error('Error en /me:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
