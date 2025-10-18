require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@tcc.local';
  const pass = process.env.SEED_ADMIN_PASS || 'Admin123!';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Admin ya existe:', email);
    process.exit(0);
  }
  const hash = await bcrypt.hash(pass, 10);
  const admin = new User({ name: 'Admin TCC', email, passwordHash: hash, role: 'admin' });
  await admin.save();
  console.log('Admin creado:', email, 'con contraseña:', pass);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });