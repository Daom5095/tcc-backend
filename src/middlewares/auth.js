/*
 * Middleware de Autenticación (auth.js).
 * Este middleware protege las rutas. Verifica que la petición
 * incluya un token JWT válido en los headers.
 */
const jwt = require('jsonwebtoken');
// Defino el secreto de JWT (debería estar en .env, pero pongo un 'default')
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

module.exports = function(req, res, next) {
  
  // 1. Busco el token en el header 'authorization'
  const auth = req.headers.authorization;
  
  // 2. Si no hay header, bloqueo la petición (401 Unauthorized)
  if (!auth) {
    return res.status(401).json({ message: 'No autorizado (No hay token)' });
  }
  
  // 3. El token debe tener el formato "Bearer <token>"
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Formato token inválido (Debe ser Bearer)' });
  }

  // Obtengo el token (la segunda parte)
  const token = parts[1];
  
  try {
    // 4. Verifico el token con mi clave secreta
    // Si el token es inválido o expiró, 'jwt.verify' lanzará un error
    const payload = jwt.verify(token, JWT_SECRET);
    
    // 5. Si es válido, adjunto el payload (datos del usuario) al objeto 'req'
    // Ahora todas las rutas protegidas tendrán acceso a 'req.user'
    // (El payload que guardé al loguear era { id, role, name, email })
    req.user = payload; 
    
    // 6. Dejo pasar la petición al siguiente middleware o a la ruta
    next();
    
  } catch (err) {
    // Si 'jwt.verify' falla, atrapo el error aquí
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};