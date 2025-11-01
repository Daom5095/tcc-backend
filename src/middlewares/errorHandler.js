/*
 * Middleware de Manejo de Errores (errorHandler.js)
 * Este es un middleware especial de Express que atrapa todos los errores
 * que ocurren en las rutas (si se llaman con next(err)).
 * Debe ser el ÚLTIMO 'app.use()' en app.js.
 */
module.exports = (err, req, res, next) => {
  // Loggeo el error en la consola del servidor para debugging
  console.error('[ERROR]', err);
  
  // Envío una respuesta JSON genérica al cliente
  // Si el error tiene un 'status' (ej. 404), lo uso. Si no, uso 500.
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor',
  });
};