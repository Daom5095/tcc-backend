const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

async function initSockets(io) {
  io.use((socket, next) => {
    // validación simple del token en handshake (token enviado en socket.handshake.auth.token)
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Auth error'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = payload; // attach user data
      return next();
    } catch (err) {
      return next(new Error('Auth error'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log('Socket conectado:', socket.id, 'user:', user.email);

  
    // Unir al usuario a una sala privada con su propio ID
    // Esto nos permite enviarle notificaciones directas (ej. io.to(user.id).emit(...))
    socket.join(user.id); 
    console.log(`Usuario ${user.name} unido a su sala personal: ${user.id}`);
   

    // Unirse a la sala pública 'general'
    const PUBLIC_ROOM = 'general';
    socket.join(PUBLIC_ROOM);

    // opcional: asegurar que exista una conversation pública en DB
    let publicConv = await Conversation.findOne({ type: 'public' });
    if (!publicConv) {
      publicConv = new Conversation({ type: 'public', participants: [] });
      await publicConv.save();
    }

    // emitir mensajes previos recientes (ej. últimos 50)
    const recent = await Message.find({ conversationId: publicConv._id }).sort({ createdAt: -1 }).limit(50).lean();
    socket.emit('recent_messages', recent.reverse());

    // recibir nuevo mensaje PÚBLICO desde cliente
    socket.on('new_message', async (payload) => {
      // payload: { content }
      try {
        const { content } = payload || {};
        if (!content || !content.trim()) return;

        const message = new Message({
          conversationId: publicConv._id,
          senderId: user.id,
          senderName: user.name,
          content: content.trim(),
        });
        await message.save();

        // actualizar lastMessageAt en conversation
        publicConv.lastMessageAt = message.createdAt;
        await publicConv.save();

        const msgToEmit = {
          id: message._id,
          conversationId: publicConv._id,
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.content,
          createdAt: message.createdAt
        };

        // emitir a todos en la sala pública
        io.to(PUBLIC_ROOM).emit('message_saved', msgToEmit);
      } catch (err) {
        console.error('Error al guardar mensaje:', err);
      }
    });

    // Unirse a una sala privada
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`${user.name} se unió a la sala ${roomId}`);
    });

    // Enviar mensaje a sala específica
    socket.on('room_message', async (payload) => {
      const { roomId, content } = payload;
      if (!roomId || !content) return;

      // Aquí asumimos que 'roomId' es un ID de Conversación válida
      const message = new Message({
        conversationId: roomId,
        senderId: user.id,
        senderName: user.name,
        content: content.trim(),
      });
      await message.save();

      io.to(roomId).emit('message_saved', {
        id: message._id,
        conversationId: roomId,
        senderId: message.senderId,
        senderName: user.name,
        content: content.trim(),
        createdAt: message.createdAt,
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket desconectado:', socket.id);
    });
  });
}

module.exports = { initSockets };