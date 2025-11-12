/*
 * Rutas de Reportes (/api/reports).
 * Endpoints para generar estadísticas y reportes históricos
 * usando agregaciones de MongoDB (pipeline $aggregate).
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole'); // Protegido por rol
const Process = require('../models/Process');
const Incident = require('../models/Incident');

/* =========================================================
   📊 OBTENER REPORTE RESUMEN (ADMIN/SUPERVISOR)
   GET /api/reports/summary
   ========================================================= */
// Protegido por auth y restringido a 'admin' o 'supervisor'
router.get('/summary', authMiddleware, checkRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const { id, role } = req.user;

    // 1. Defino el filtro base (query de Match)
    const matchQuery = {};
    if (role === 'supervisor') {
      // Los supervisores solo ven reportes de los procesos que ELLOS crearon.
      matchQuery.createdBy = id;
    }
    // (Si es 'admin', matchQuery queda vacío, por lo que ve todo)

    // 2. Agregación de Procesos (Pipeline complejo)
    const processStats = await Process.aggregate([
      // $match: Aplico el filtro (vacío para admin, con createdBy para supervisor)
      { $match: matchQuery },
      
      // $facet: Uso $facet para correr múltiples agregaciones en paralelo
      {
        $facet: {
          // A: Contar procesos por estado
          "statusCounts": [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            // Salida: [{ _id: "aprobado", count: 5 }, { _id: "pendiente", count: 2 }]
          ],
          
          // B: Contar procesos por revisor asignado
          "byRevisor": [
            { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
            { $sort: { count: -1 } }, // Ordeno por el que más tiene
            // $lookup: Hago un 'join' con la colección 'users'
            {
              $lookup: {
                from: 'users',
                localField: '_id', // El ID del revisor (assignedTo)
                foreignField: '_id', // El ID del usuario
                as: 'revisorInfo' // Guardo el resultado en un array
              }
            },
            { $unwind: '$revisorInfo' }, // Descomprimo el array (de [user] a user)
            { 
              // $project: Defino la salida final
              $project: { 
                _id: 0,
                count: 1,
                revisorId: "$_id",
                revisorName: "$revisorInfo.name",
                revisorEmail: "$revisorInfo.email"
              }
            }
          ]
        }
      }
    ]);
    
    // 3. Agregación de Incidentes (separada para simplicidad)
    // (Aquí no apliqué el filtro de supervisor, aunque debería
    //  hacerlo con un $lookup previo. Es una mejora pendiente)
    const incidentStats = await Incident.aggregate([
      // Agrupo incidentes por severidad
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 }
        }
      }
      // Salida: [{ _id: "critica", count: 3 }, { _id: "media", count: 10 }]
    ]);

    // 4. Formatear la respuesta
    const response = {
      // $facet devuelve un array con UN elemento, por eso accedo a [0]
      statusCounts: processStats[0].statusCounts,
      byRevisor: processStats[0].byRevisor,
      incidentSeverityCounts: incidentStats
    };

    res.json(response);

  } catch (err) {
    console.error('Error en GET /api/reports/summary:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


module.exports = router;