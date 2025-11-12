/*
 * Módulo de Sockets (sockets/index.js).
 * --- ¡MODIFICADO CON "IS TYPING" (FASE 2 - PASO 2)! ---
 * --- ¡MODIFICADO CON NOTIFICACIONES INTELIGENTES (MEJORA)! ---
 *
 * Este archivo centraliza TODA la lógica de Socket.io.
 * Es llamado por 'server.js' y recibe la instancia 'io'.
 */
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification'); // Para notificaciones de chat
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

/**
 * Función helper para asegurar que la conversación pública 'general' exista.
 * La llamo 'lazy' (solo cuando se necesita).
 */
async function getPublicConversation() {
  let publicConv = await Conversation.findOne({ type: 'public' });
  if (!publicConv) {
    // Si es el primer inicio, creo la sala 'general'
    publicConv = new Conversation({ type: 'public', participants: [] });
    await publicConv.save();
  }
  return publicConv;
}

/**
 * Función principal que inicializa todos los manejadores de Sockets.
 * @param {SocketIO.Server} io - La instancia del servidor Socket.io
 */
async function initSockets(io) {

  // --- MIDDLEWARE DE AUTENTICACIÓN (para Sockets) ---
  // Esto es un "guardia" para CADA nueva conexión de socket.
  io.use((socket, next) => {
    // El token JWT debe venir en el payload 'auth' de la conexión
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Auth error (No token provided)'));
    }
    try {
      // Verifico el mismo token que uso para la API REST
      const payload = jwt.verify(token, JWT_SECRET);
      
      // Adjunto los datos del usuario AL SOCKET
      socket.user = payload; // { id, role, name, email }
      return next(); // Dejo pasar (conexión exitosa)
    } catch (err) {
      return next(new Error('Auth error (Invalid token)')); // Rechazo la conexión
    }
  });

  // --- MANEJADOR DE CONEXIÓN ---
  // Esto se ejecuta DESPUÉS del middleware, solo para sockets autenticados.
  io.on('connection', async (socket) => {
    const user = socket.user; // Obtengo el usuario que adjunté en el middleware
    console.log('Socket conectado:', socket.id, 'user:', user.email);

    // --- LÓGICA DE SALAS (ROOMS) ---
    
    // 1. Sala Personal (para notificaciones)
    // Hago que el usuario se una a una sala con su propio ID.
    // Esto me permite enviarle notificaciones PUSH solo a él.
    // (ej. io.to(userId).emit('notificacion_privada', ...))
    socket.join(user.id); 
    console.log(`Usuario ${user.name} unido a su sala personal: ${user.id}`);
   
    // 2. Sala Pública General (para el chat)
    const PUBLIC_ROOM = 'general';
    socket.join(PUBLIC_ROOM);

    
    // --- LÓGICA DE CHAT GENERAL ('general') ---
    
    // Evento: El cliente pide el historial del chat general
    socket.on('chat:get_general_history', async () => {
      try {
        console.log(`Socket ${socket.id} pidió historial general.`);
        const conv = await getPublicConversation();
        const messages = await Message.find({ conversationId: conv._id })
          .sort({ createdAt: -1 }) // Más nuevos primero
          .limit(50) // Limito a los últimos 50
          .lean(); // .lean() para que sea más rápido (solo JSON)
        
        // Emito el historial SOLO a este socket (el que lo pidió)
        socket.emit('chat:general_history', messages.reverse()); // .reverse() para pintarlos bien
      } catch (err) {
         console.error('Error al enviar historial de chat:', err);
      }
    });

    // Evento: El cliente envía un mensaje al chat general
    socket.on('chat:send_general', async (payload) => {
      try {
        const { content } = payload || {};
        if (!content || !content.trim()) return; // No guardar mensajes vacíos

        const conv = await getPublicConversation();
        
        // 1. Guardo el mensaje en la BD
        const message = new Message({
          conversationId: conv._id,
          senderId: user.id,
          senderName: user.name, // Denormalizado para velocidad
          content: content.trim(),
        });
        await message.save();

        // 2. Actualizo la 'lastMessageAt' de la conversación
        conv.lastMessageAt = message.createdAt;
        await conv.save();
        
        // (Formateo el mensaje para emitirlo, aunque toObject() funcionaría)
        const msgToEmit = {
          _id: message._id,
          id: message._id, 
          conversationId: conv._id,
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.content,
          createdAt: message.createdAt
        };

        // 3. Emito el mensaje a TODOS en la sala 'general'
        io.to(PUBLIC_ROOM).emit('chat:receive_general', msgToEmit);
      } catch (err) {
        console.error('Error al guardar mensaje:', err);
      }
    });

    // --- Lógica de "Escribiendo..." (Chat General) ---
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


    // --- LÓGICA DE CHAT PRIVADO ---
    
    // Evento: El cliente avisa que entró a un chat privado (ej. /chat/12345)
    socket.on('join_room', (roomId) => {
      // Lo uno a la sala de esa conversación (que es el ID de la Conversation)
      socket.join(roomId);
      console.log(`${user.name} se unió a la sala ${roomId}`);
    });

    // Evento: El cliente envía un mensaje privado
    socket.on('chat:send_private', async (payload) => {
      try {
        const { roomId, content } = payload; // roomId es el Conversation ID
        if (!roomId || !content) return;

        // 1. Guardo el mensaje en la BD
        const message = new Message({
          conversationId: roomId,
          senderId: user.id,
          senderName: user.name,
          content: content.trim(),
        });
        await message.save();
        
        const conv = await Conversation.findById(roomId);
        if(!conv) return;

        // 2. Actualizo 'lastMessageAt' de la conversación
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

        // 3. Enviar el mensaje a todos en la sala (incluido el emisor)
        io.to(roomId).emit('chat:receive_private', msgToEmit);

        
        // 4. --- Lógica de Notificación Inteligente ---
        //    (Esta es la mejora clave)
        //    Recorro los participantes de la conversación
        conv.participants.forEach(async (participantId) => {
          
          // Solo proceso a los REceptores (no a mí mismo)
          if (participantId.toString() !== user.id) {
            
            // 4.1. Obtengo todos los sockets activos del receptor
            // (Un usuario puede estar conectado desde el móvil y el PC)
            const recipientSockets = await io.in(participantId.toString()).fetchSockets();

            // 4.2. Compruebo si ALGUNO de sus sockets está en la sala de chat actual
            const isRecipientInRoom = recipientSockets.some(sock => sock.rooms.has(roomId));

            // 4.3. Si el receptor NO está en la sala (no tiene este chat abierto),
            //      le envío la notificación "push".
            if (!isRecipientInRoom) {
              const messageForNotif = `Nuevo mensaje de ${user.name}: "${content.substring(0, 30)}..."`;
              
              // Guardo la notificación en la BD
              const newNotification = new Notification({
                user: participantId,
                message: messageForNotif,
                link: `/chat/${roomId}`, // Link para el frontend
                type: 'chat'
              });
              await newNotification.save();
              
              // 4.4. Emito la notificación solo a la sala *personal* del receptor
              io.to(participantId.toString()).emit('chat:new_message_notification', newNotification);
            }
          }
        });

      } catch (err) {
        console.error('Error en chat:send_private:', err);
      }
    });

    // --- Lógica de "Escribiendo..." (Chat Privado) ---
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

    // (Manejador de desconexión - sin cambios)
    socket.on('disconnect', () => {
      console.log('Socket desconectado:', socket.id);
    });
  });
}

// Exporto la función principal
module.exports = { initSockets };