/*
 * Middleware de Manejo de Errores (errorHandler.js)
 * Este es un middleware especial de Express que atrapa todos los errores
 * que ocurren en las rutas (si se llaman con next(err)).
 * Debe ser el ÚLTIMO 'app.use()' en app.js.
 */
module.exports = (err, req, res, next) => {
  // 1. Loggeo el error completo en la consola del servidor para debugging
  // (Así yo puedo ver qué pasó, pero el cliente no)
  console.error('[ERROR]', err);
  
  // 2. Envío una respuesta JSON genérica al cliente
  
  // Si el error que lancé tiene una propiedad 'status' (ej. 404), la uso.
  // Si no (si fue un error 500 inesperado), uso 500 (Error Interno).
  const statusCode = err.status || 500;
  
  // Envío un mensaje de error claro.
  const message = err.message || 'Error interno del servidor';
  
  res.status(statusCode).json({
    message: message,
  });
};