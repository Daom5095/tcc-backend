/**
 * Middleware para verificar roles de usuario.
 * @param {Array<String>} allowedRoles - Array de roles permitidos (ej. ['admin', 'supervisor'])
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // Se asume que el middleware 'auth' ya se ejecutó
    // y pobló req.user con el payload del JWT
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { role } = req.user;

    if (allowedRoles.includes(role)) {
      next(); // El rol está permitido, continuar
    } else {
      return res.status(403).json({ message: 'Acceso denegado: Rol no autorizado' });
    }
  };
};

module.exports = checkRole;