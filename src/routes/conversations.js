/*
 * Rutas de Conversaciones (/api/conversations).
 * Maneja la creación y obtención de chats privados y el historial de mensajes.
 * Esta API se usa para 'cargar' la vista de chat, mientras que
 * Socket.io se usa para los mensajes 'en vivo'.
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middlewares/auth'); // Protegido por auth
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message'); // Importo Mensajes

/* =========================================================
   💬 INICIAR UNA NUEVA CONVERSACIÓN PRIVADA
   POST /api/conversations/
   ========================================================= */
// Este endpoint crea una conversación privada o la devuelve si ya existe.
// Es 'idempotente' para chats privados.
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiverId } = req.body; // El ID del usuario con quien quiero chatear
    const senderId = req.user.id; // Mi propio ID (viene del authMiddleware)

    // 1. Validaciones básicas
    if (!receiverId) {
      return res.status(400).json({ message: 'El ID del receptor es obligatorio' });
    }
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: 'El ID del receptor no es válido' });
    }
    if (receiverId === senderId) {
      return res.status(400).json({ message: 'No puedes iniciar un chat contigo mismo' });
    }
    
    // 2. Verificar que el receptor exista
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Usuario receptor no encontrado' });
    }

    // 3. Buscar si YA EXISTE una conversación privada entre estos dos usuarios
    // Uso '$all' para buscar un array que contenga AMBOS IDs,
    // sin importar el orden [senderId, receiverId] o [receiverId, senderId].
    let existingConversation = await Conversation.findOne({
      type: 'private',
      participants: { $all: [senderId, receiverId] }
    });

    if (existingConversation) {
      // Si ya existe, simplemente la devuelvo (200 OK)
      return res.json(existingConversation);
    }

    // 4. Si no existe, creo la nueva conversación
    const newConversation = new Conversation({
      type: 'private',
      participants: [senderId, receiverId],
      lastMessageAt: Date.now() // Pongo la fecha actual para que aparezca
    });

    await newConversation.save();
    
    // (Opcional: Podría emitir un socket al 'receiverId' para notificarle
    //  que tiene un nuevo chat, pero la lógica de chat maneja esto)
    
    // Devuelvo la nueva conversación (201 Creado)
    res.status(201).json(newConversation);

  } catch (err) {
    console.error('Error en POST /api/conversations:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


/* =========================================================
   📚 OBTENER MIS CONVERSACIONES (PRIVADAS Y PÚBLICAS)
   GET /api/conversations/
   ========================================================= */
// Devuelve una lista de todas las conversaciones en las que participo.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      // Busco todas las conversaciones donde yo esté en 'participants'
      // O las que sean 'public' (como 'general')
      $or: [
        { participants: userId },
        { type: 'public' }
      ]
    })
    .populate({
      path: 'participants',
      select: 'name email role' // Populo los datos de los participantes
    })
    .sort({ lastMessageAt: -1 }); // Ordeno por el último mensaje (más reciente arriba)

    // (El frontend tendrá que filtrar mi propio usuario de la lista de 'participants'
    // para mostrar el nombre del 'otro' usuario en un chat privado)
    
    res.json(conversations);

  } catch (err) {
    console.error('Error en GET /api/conversations:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


/* =========================================================
   HISTORIAL DE MENSAJES DE UN CHAT
   GET /api/conversations/:id/messages
   ========================================================= */
// Devuelve todos los mensajes de una conversación específica.
// (Lo usaba antes, pero ahora prefiero cargar el historial con Socket.io)
router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user.id;

    // 1. Verifico que la conversación exista Y que yo sea participante
    const conversation = await Conversation.findOne({
      _id: conversationId,
      // Solo puedo ver chats públicos o chats privados donde yo participe
      $or: [
        { type: 'public' },
        { participants: userId }
      ]
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada o no tienes acceso' });
    }

    // 2. Si todo está OK, busco los mensajes
    const messages = await Message.find({ conversationId: conversationId })
      .sort({ createdAt: 1 }); // Ordenados del más viejo al más nuevo

    res.json(messages);

  } catch (err) {
    console.error('Error en GET /api/conversations/:id/messages:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


module.exports = router;