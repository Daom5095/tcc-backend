/*
 * SCRIPT DE SEED (SEMILLA) PARA CREAR EL ADMIN.
 * Este script se ejecuta manualmente UNA SOLA VEZ para inicializar
 * la base de datos con el primer usuario administrador.
 * * EJECUCIÓN: node scripts/seedAdmin.js
 */
require('dotenv').config(); // Cargo el .env para MONGO_URI y las credenciales
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User'); // Importo el modelo de User

async function main(){
  // 1. Conectar a la BD
  await mongoose.connect(process.env.MONGO_URI);
  
  // 2. Definir credenciales del admin (desde .env o usar defaults)
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@tcc.local';
  const pass = process.env.SEED_ADMIN_PASS || 'Admin123!';
  
  // 3. Verificar si ya existe
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Admin ya existe:', email);
    process.exit(0); // Salgo del script (éxito)
  }
  
  // 4. Si no existe, crearlo
  console.log('Creando admin...');
  const hash = await bcrypt.hash(pass, 10);
  
  const admin = new User({ 
    name: 'Admin TCC', 
    email: email, 
    passwordHash: hash, 
    role: 'admin' 
  });
  
  await admin.save();
  
  console.log('Admin creado:', email, 'con contraseña:', pass);
  process.exit(0); // Salgo del script (éxito)
}

// Ejecuto la función principal y atrapo errores
main().catch(err => { 
  console.error(err); 
  process.exit(1); // Salgo con código de error
});