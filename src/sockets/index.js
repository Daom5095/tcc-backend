/*
 * Módulo de Sockets (sockets/index.js).
 * Lógica de comunicación en tiempo real.
 * --- ¡VERSIÓN CORREGIDA CON EVENTOS DE CHAT SEPARADOS! ---
 */
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

// Función para obtener la conversación pública (y crearla si no existe)
async function getPublicConversation() {
  let publicConv = await Conversation.findOne({ type: 'public' });
  if (!publicConv) {
    publicConv = new Conversation({ type: 'public', participants: [] });
    await publicConv.save();
  }
  return publicConv;
}

async function initSockets(io) {

  // --- MIDDLEWARE DE AUTENTICACIÓN PARA SOCKETS ---
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Auth error (No token provided)'));
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = payload; // { id, role, name, email }
      return next();
    } catch (err) {
      return next(new Error('Auth error (Invalid token)'));
    }
  });

  // --- MANEJADOR DE CONEXIÓN EXITOSA ---
  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log('Socket conectado:', socket.id, 'user:', user.email);

  
    // --- 1. SALA PERSONAL (PARA NOTIFICACIONES) ---
    socket.join(user.id); 
    console.log(`Usuario ${user.name} unido a su sala personal: ${user.id}`);
   
    // --- 2. SALA PÚBLICA (PARA CHAT GENERAL) ---
    const PUBLIC_ROOM = 'general';
    socket.join(PUBLIC_ROOM);

    
    // --- LÓGICA DE CHAT GENERAL ---
    
    // (Ya no envío el historial al conectar, espero a que me lo pidan)
    
    // --- ¡MEJORA! ---
    // Escucho si un cliente me pide el historial general
    socket.on('chat:get_general_history', async () => {
      try {
        console.log(`Socket ${socket.id} pidió historial general.`);
        const conv = await getPublicConversation();
        const messages = await Message.find({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
        // Le envío el historial SOLO a él con el nuevo nombre de evento
        socket.emit('chat:general_history', messages.reverse());
      } catch (err) {
         console.error('Error al enviar historial de chat:', err);
      }
    });
    // --- FIN DE LA MEJORA ---


    // Escucho el evento 'chat:send_general' (cuando un cliente envía un mensaje PÚBLICO)
    socket.on('chat:send_general', async (payload) => {
      try {
        const { content } = payload || {};
        if (!content || !content.trim()) return; 

        const conv = await getPublicConversation();
        
        const message = new Message({
          conversationId: conv._id,
          senderId: user.id,
          senderName: user.name, 
          content: content.trim(),
        });
        await message.save();

        conv.lastMessageAt = message.createdAt;
        await conv.save();

        const msgToEmit = {
          _id: message._id,
          id: message._id, 
          conversationId: conv._id,
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.content,
          createdAt: message.createdAt
        };

        // Emito el mensaje guardado a TODOS en la sala pública con el nuevo nombre
        io.to(PUBLIC_ROOM).emit('chat:receive_general', msgToEmit);
      } catch (err) {
        console.error('Error al guardar mensaje:', err);
      }
    });

    // --- LÓGICA DE CHAT PRIVADO ---
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`${user.name} se unió a la sala ${roomId}`);
    });

    // Escucho 'chat:send_private'
    socket.on('chat:send_private', async (payload) => {
      const { roomId, content } = payload;
      if (!roomId || !content) return;

      const message = new Message({
        conversationId: roomId,
        senderId: user.id,
        senderName: user.name,
        content: content.trim(),
      });
      await message.save();
      
      await Conversation.updateOne({_id: roomId}, { lastMessageAt: message.createdAt });

      const msgToEmit = {
        _id: message._id,
        id: message._id,
        conversationId: roomId,
        senderId: message.senderId,
        senderName: message.senderName, // Corregido para usar el nombre del user
        content: message.content,
        createdAt: message.createdAt,
      };

      // Emito el mensaje solo a los miembros de esa sala (roomId) con el nuevo nombre
      io.to(roomId).emit('chat:receive_private', msgToEmit);
    });

    // Manejador de desconexión
    socket.on('disconnect', () => {
      console.log('Socket desconectado:', socket.id);
    });
  });
}

module.exports = { initSockets };