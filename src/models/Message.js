const mongoose = require('mongoose');
const { Schema } = mongoose;

const attachmentSchema = new Schema({
  url: String,
  type: String,
}, { _id: false });

const messageSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String }, // redundancia útil para mostrar
  content: { type: String },
  attachments: [attachmentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);