# Proyecto TCC: Plataforma Colaborativa (Backend) 🚀

Backend de la plataforma TCC, enfocado en la gestión de procesos y comunicación en tiempo real.

## 🛠️ Tecnologías Utilizadas

* **Node.js**: Entorno de ejecución de JavaScript.
* **Express.js**: Framework para construir la API REST.
* **MongoDB**: Base de datos NoSQL para almacenar toda la información.
* **Mongoose**: Librería para modelar los datos de MongoDB.
* **Socket.io**: Para la comunicación en tiempo real (notificaciones y chat).
* **JSON Web Tokens (JWT)**: Para la autenticación y manejo de sesiones.
* **Bcrypt**: Para el hasheo seguro de contraseñas.
* **Joi**: Para la validación de datos de entrada en la API.
* **Dotenv**: Para el manejo de variables de entorno.
* **CORS, Helmet, Morgan**: Middlewares para seguridad y logging.

## ⚙️ Configuración y Primeros Pasos

Para que el proyecto funcione, necesitas configurar la base de datos y crear el usuario administrador.

**1. Instalar Dependencias:**
Abre una terminal en esta carpeta (`tcc-backend`) y ejecuta:
```bash
npm install

2. Configurar Variables de Entorno: Crea un archivo llamado .env en la raíz de la carpeta tcc-backend y añade tu cadena de conexión de MongoDB.

# Ejemplo de .env
MONGO_URI=mongodb://127.0.0.1:27017/tcc-database
3. Crear el Usuario Administrador (¡Importante!) Este proyecto tiene un script para crear el usuario 'admin' por defecto. Ejecútalo una vez:

Bash

node scripts/seedAdmin.js
La terminal te dirá Admin creado... o Admin ya existe.... Ambas son correctas.

Las credenciales de este admin son:

Email: admin@tcc.local

Contraseña: Admin123!

▶️ Cómo Ejecutar el Proyecto
Con la configuración lista, inicia el servidor en modo de desarrollo (se reinicia solo con los cambios):

Bash

npm run dev
El servidor estará corriendo en http://localhost:4000.

📊 Estado Actual y Funcionalidades
El backend actualmente soporta:

Sistema de Autenticación:

POST /auth/register: Registro de nuevos usuarios (rol 'revisor' por defecto).

POST /auth/login: Inicio de sesión que devuelve un token JWT.

GET /auth/me: Ruta protegida para verificar el token y obtener los datos del usuario.

Sistema de Roles:

Los usuarios tienen roles (revisor, supervisor, admin).

API de Gestión de Procesos:

GET /api/processes: Obtiene la lista de procesos (filtrada por rol).

POST /api/processes: (Protegida para Admin/Supervisor) Crea un nuevo proceso y lo asigna a un revisor.

Sistema de Notificaciones en Tiempo Real (Socket.io):

Los usuarios se autentican en el socket usando su JWT.

Los usuarios se unen a una sala privada (basada en su User ID) para recibir notificaciones personales.

Eventos emitidos:

process:assigned: Se envía al 'revisor' cuando se le asigna un nuevo proceso.

incident:created: Se envía al 'supervisor' cuando un 'revisor' reporta una incidencia.

process:status_updated: Se envía al 'revisor' cuando su proceso es aprobado/rechazado.

Chat Básico:

Funcionalidad de chat público en la sala 'general'.

Lógica para salas privadas (join_room y room_message).