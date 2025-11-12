// src/routes/auth.js
/*
 * Rutas de Autenticación (/auth).
 * Maneja el registro (register), inicio de sesión (login) y 
 * la verificación del token del usuario (me).
 */
const express = require('express');
const bcrypt = require('bcrypt'); // Para hashear y comparar contraseñas
const jwt = require('jsonwebtoken'); // Para crear y firmar tokens
const Joi = require('joi'); // Para validar los datos de entrada
const User = require('../models/User'); // Mi modelo de Usuario
const authMiddleware = require('../middlewares/auth'); // Mi middleware de auth

const router = express.Router();
// Defino el secreto de JWT (debería estar en .env)
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

/* =========================================================
   🧩 VALIDACIONES DE DATOS (SCHEMAS DE JOI)
   ========================================================= */
   
// Esquema de validación para el registro
const registerSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    'string.empty': 'El nombre es obligatorio',
    'string.min': 'El nombre debe tener al menos 3 caracteres',
  }),
  
  // Añadí { tlds: false } para desactivar la validación de TLD.
  // Esto me permite usar emails de prueba como 'admin@tcc.local'.
  email: Joi.string().trim().email({ tlds: false }).required().messages({ 
    'string.email': 'Debe ingresar un correo válido',
    'any.required': 'El correo es obligatorio'
  }),

  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'La contraseña debe tener al menos 6 caracteres',
  }),
  // Permito que se especifique un rol al registrar (útil para crear admins/supervisores)
  role: Joi.string().valid('revisor', 'supervisor', 'admin')
});

// Esquema de validación para el login
const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: false }).required().messages({ 
    'string.email': 'Debe ingresar un correo válido',
    'any.required': 'El correo es obligatorio'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'La contraseña debe tener al menos 6 caracteres',
    'any.required': 'La contraseña es obligatoria'
  })
});

/* =========================================================
   📥 ENDPOINT: REGISTRO DE USUARIOS
   POST /auth/register
   ========================================================= */
router.post('/register', async (req, res) => {
  try {
    // Forzamos el trim para el email antes de validar
    if (req.body.email) {
      req.body.email = req.body.email.trim();
    }

    // 1. Validar los datos de entrada con Joi
    const { error } = registerSchema.validate(req.body);
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const { name, email, password, role } = req.body;

    // 2. Verificar si el usuario ya existe
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: 'El usuario ya existe' }); // 409 Conflict

    // 3. Hashear la contraseña (costo 10)
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Crear el nuevo usuario en la BD
    const user = new User({ 
      name, 
      email, 
      passwordHash, // Guardo el hash, no la contraseña
      role // Si 'role' no viene, el modelo usará 'revisor' por defecto
    });
    await user.save();

    // 5. Generar un token JWT para el nuevo usuario (para auto-loguearlo)
    const token = jwt.sign(
      // Payload del token:
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' } // El token expira en 8 horas
    );

    // 6. Enviar la respuesta (201 Creado)
    res.status(201).json({
      // Devuelvo el usuario (sin el hash) y el token
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('Error en /register:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* =========================================================
   🔐 ENDPOINT: LOGIN DE USUARIOS
   POST /auth/login
   ========================================================= */
router.post('/login', async (req, res) => {
  try {
    
    // Limpio el email antes de validar
    if (req.body.email) {
      req.body.email = req.body.email.trim();
    }
    
    // 1. Validar los datos de entrada con Joi
    const { error } = loginSchema.validate(req.body);
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;

    // 2. Buscar al usuario por email
    const user = await User.findOne({ email });
    if (!user)
      // Doy un mensaje genérico por seguridad (no revelar si existe el email)
      return res.status(401).json({ message: 'Credenciales inválidas' });

    // 3. Comparar la contraseña enviada con el hash guardado
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      // Mensaje genérico
      return res.status(401).json({ message: 'Credenciales inválidas' });

    // 4. Si todo está OK, generar el token
    const token = jwt.sign(
      // Guardo los datos clave del usuario en el payload del token
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' } // Expiración de 8 horas
    );

    // 5. Enviar respuesta (200 OK)
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
   👤 ENDPOINT: OBTENER PERFIL DE USUARIO LOGUEADO
   GET /auth/me
   ========================================================= */
// Esta ruta está protegida. 'authMiddleware' se ejecuta primero.
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // 1. Gracias a 'authMiddleware', ya tengo 'req.user.id' del token
    
    // 2. Busco al usuario en la BD para tener los datos MÁS actualizados
    //    (ej. si cambió su nombre)
    //    Uso .select('-passwordHash') para excluir el hash de la respuesta.
    const user = await User.findById(req.user.id).select('-passwordHash');
    
    if (!user)
      return res.status(404).json({ message: 'Usuario no encontrado' });
      
    // 3. Devuelvo el objeto de usuario
    res.json({ user });
  } catch (err) {
    console.error('Error en /me:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;