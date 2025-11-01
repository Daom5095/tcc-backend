/*
 * Rutas de Reportes (/api/reports).
 * Endpoints para generar estadísticas y reportes históricos
 * usando agregaciones de MongoDB.
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
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
    // Los supervisores solo ven reportes de los procesos que ELLOS crearon.
    // Los admins ven reportes de TODOS los procesos.
    const matchQuery = {};
    if (role === 'supervisor') {
      matchQuery.createdBy = id;
    }

    // 2. Agregación de Procesos
    const processStats = await Process.aggregate([
      // Aplico el filtro (vacío para admin, con createdBy para supervisor)
      { $match: matchQuery },
      
      // Uso $facet para correr múltiples agregaciones en paralelo
      {
        $facet: {
          // A: Contar procesos por estado
          "statusCounts": [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            // { _id: "aprobado", count: 5 }, { _id: "pendiente", count: 2 }
          ],
          
          // B: Contar procesos por revisor asignado
          "byRevisor": [
            { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            // Hago un 'lookup' para obtener el nombre del revisor
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'revisorInfo'
              }
            },
            { $unwind: '$revisorInfo' }, // Descomprimo el array
            { 
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
    // (Podría anidarla con $lookup en la de procesos, pero así es más claro)
    const incidentStats = await Incident.aggregate([
      // (Si soy supervisor, idealmente debería filtrar solo incidentes
      // de procesos que yo cree, pero eso requiere un $lookup complejo primero.
      // Por ahora, un admin ve todo y un supervisor ve esto simplificado)
      
      // Agrupo incidentes por severidad
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 }
        }
      }
      // { _id: "critica", count: 3 }, { _id: "media", count: 10 }
    ]);

    // 4. Formatear la respuesta
    const response = {
      // Tomo el primer (y único) resultado del $facet
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