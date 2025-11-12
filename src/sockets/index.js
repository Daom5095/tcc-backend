/*
 * Módulo de Sockets (sockets/index.js).
 * --- ¡MODIFICADO CON "IS TYPING" (FASE 2 - PASO 2)! ---
 * --- ¡MODIFICADO CON NOTIFICACIONES INTELIGENTES (MEJORA)! ---
 */
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

async function getPublicConversation() {
  let publicConv = await Conversation.findOne({ type: 'public' });
  if (!publicConv) {
    publicConv = new Conversation({ type: 'public', participants: [] });
    await publicConv.save();
  }
  return publicConv;
}

async function initSockets(io) {

  // --- MIDDLEWARE DE AUTENTICACIÓN (sin cambios) ---
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

  // --- MANEJADOR DE CONEXIÓN ---
  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log('Socket conectado:', socket.id, 'user:', user.email);

    socket.join(user.id); 
    console.log(`Usuario ${user.name} unido a su sala personal: ${user.id}`);
   
    const PUBLIC_ROOM = 'general';
    socket.join(PUBLIC_ROOM);

    
    // --- LÓGICA DE CHAT GENERAL ---
    
    // (Obtener historial - sin cambios)
    socket.on('chat:get_general_history', async () => {
      try {
        console.log(`Socket ${socket.id} pidió historial general.`);
        const conv = await getPublicConversation();
        const messages = await Message.find({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
        socket.emit('chat:general_history', messages.reverse());
      } catch (err) {
         console.error('Error al enviar historial de chat:', err);
      }
    });

    // (Enviar mensaje - sin cambios)
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

        io.to(PUBLIC_ROOM).emit('chat:receive_general', msgToEmit);
      } catch (err) {
        console.error('Error al guardar mensaje:', err);
      }
    });

    // --- NUEVO: Lógica de "Escribiendo" para Chat General ---
    socket.on('chat:start_typing_general', () => {
      // Avisa a TODOS MENOS a mí
      socket.broadcast.to(PUBLIC_ROOM).emit('chat:user_typing_general', { 
        name: user.name 
      });
    });

    socket.on('chat:stop_typing_general', () => {
      // Avisa a TODOS MENOS a mí
      socket.broadcast.to(PUBLIC_ROOM).emit('chat:user_stopped_typing_general', {
        name: user.name
      });
    });
    // --- Fin de "Escribiendo" General ---


    // --- LÓGICA DE CHAT PRIVADO ---
    
    // (Unirse a sala - sin cambios)
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`${user.name} se unió a la sala ${roomId}`);
    });

    // --- ¡MEJORA! (Enviar mensaje privado - MODIFICADO) ---
    socket.on('chat:send_private', async (payload) => {
      try {
        const { roomId, content } = payload;
        if (!roomId || !content) return;

        const message = new Message({
          conversationId: roomId,
          senderId: user.id,
          senderName: user.name,
          content: content.trim(),
        });
        await message.save();
        
        const conv = await Conversation.findById(roomId);
        if(!conv) return;

        conv.lastMessageAt = message.createdAt;
        await conv.save();

        const msgToEmit = {
          _id: message._id,
          id: message._id,
          conversationId: roomId,
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.content,
          createdAt: message.createdAt,
        };

        // 1. Enviar el mensaje a todos en la sala (incluido el emisor)
        io.to(roomId).emit('chat:receive_private', msgToEmit);

        
        // 2. Lógica de Notificación Inteligente
        conv.participants.forEach(async (participantId) => {
          // Solo proceso a los receptores (no a mí mismo)
          if (participantId.toString() !== user.id) {
            
            // 2.1. Obtengo todos los sockets activos del receptor
            // (Un usuario puede estar conectado desde el móvil y el PC)
            const recipientSockets = await io.in(participantId.toString()).fetchSockets();

            // 2.2. Compruebo si ALGUNO de sus sockets está en la sala de chat actual
            const isRecipientInRoom = recipientSockets.some(sock => sock.rooms.has(roomId));

            // 2.3. Si el receptor NO está en la sala (no tiene este chat abierto),
            // le envío la notificación "push".
            if (!isRecipientInRoom) {
              const messageForNotif = `Nuevo mensaje de ${user.name}: "${content.substring(0, 30)}..."`;
              
              const newNotification = new Notification({
                user: participantId,
                message: messageForNotif,
                link: `/chat/${roomId}`,
                type: 'chat'
              });
              await newNotification.save();
              
              // 2.4. Emito la notificación solo a la sala *personal* del receptor
              io.to(participantId.toString()).emit('chat:new_message_notification', newNotification);
            }
          }
        });

      } catch (err) {
        console.error('Error en chat:send_private:', err);
      }
    });
    // --- Fin de la Mejora ---


    // --- NUEVO: Lógica de "Escribiendo" para Chat Privado ---
    socket.on('chat:start_typing_private', ({ roomId }) => {
      // Avisa a TODOS en la sala MENOS a mí
      socket.broadcast.to(roomId).emit('chat:user_typing_private', { 
        name: user.name 
      });
    });

    socket.on('chat:stop_typing_private', ({ roomId }) => {
      // Avisa a TODOS en la sala MENOS a mí
      socket.broadcast.to(roomId).emit('chat:user_stopped_typing_private', {
        name: user.name
      });
    });
    // --- Fin de "Escribiendo" Privado ---

    // (Desconexión - sin cambios)
    socket.on('disconnect', () => {
      console.log('Socket desconectado:', socket.id);
    });
  });
}

module.exports = { initSockets };