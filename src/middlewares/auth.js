/*
 * Middleware de Autenticación (auth.js).
 * Este middleware protege las rutas. Verifica que la petición
 * incluya un token JWT válido.
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

module.exports = function(req, res, next) {
  // 1. Busco el token en el header 'authorization'
  const auth = req.headers.authorization;
  
  // Si no hay header, bloqueo la petición (401 Unauthorized)
  if (!auth) return res.status(401).json({ message: 'No autorizado (No hay token)' });
  
  // 2. El token debe tener el formato "Bearer <token>"
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Formato token inválido (Debe ser Bearer)' });
  }

  const token = parts[1];
  
  try {
    // 3. Verifico el token con mi clave secreta
    const payload = jwt.verify(token, JWT_SECRET);
    
    // 4. Si es válido, adjunto el payload (datos del usuario) al objeto 'req'
    // Ahora todas las rutas protegidas tendrán acceso a 'req.user'
    req.user = payload; // payload = { id, role, name, email }
    
    // Dejo pasar la petición al siguiente middleware o a la ruta
    next();
  } catch (err) {
    // Si el token es inválido (expirado, manipulado), bloqueo la petición
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};