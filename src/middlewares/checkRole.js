/**
 * Middleware para verificar roles de usuario (checkRole.js).
 * Es un "Factory Function": una función que devuelve el middleware real.
 * Esto me permite reutilizarlo pasando diferentes roles.
 *
 * EJEMPLO DE USO en una ruta:
 * router.get('/admin', authMiddleware, checkRole(['admin']), (req, res) => { ... });
 * router.post('/proceso', authMiddleware, checkRole(['admin', 'supervisor']), (req, res) => { ... });
 *
 * @param {Array<String>} allowedRoles - Array de roles permitidos (ej. ['admin', 'supervisor'])
 */
const checkRole = (allowedRoles) => {
  
  // Esta es la función de middleware que Express usará
  // (se ejecuta después de 'auth.js')
  return (req, res, next) => {
    
    // 1. Asumo que el middleware 'auth.js' ya se ejecutó
    // y pobló req.user
    if (!req.user || !req.user.role) {
      // Este error no debería pasar si 'auth' se usó primero, pero es una defensa
      return res.status(401).json({ message: 'No autorizado (Usuario no verificado)' });
    }

    const { role } = req.user;

    // 2. Compruebo si el rol del usuario está en la lista de roles permitidos
    if (allowedRoles.includes(role)) {
      next(); // El rol está permitido, continuar
    } else {
      // El rol no está permitido, devuelvo 403 Forbidden
      // (Está autenticado pero no autorizado para ESTA acción)
      return res.status(403).json({ message: 'Acceso denegado: Rol no autorizado' });
    }
  };
};

module.exports = checkRole;