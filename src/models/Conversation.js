const mongoose = require('mongoose');
const { Schema } = mongoose;

const conversationSchema = new Schema({
  type: { type: String, enum: ['public','private'], default: 'public' },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  lastMessageAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);