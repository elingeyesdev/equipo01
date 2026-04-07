# 🚗 Plataforma de Parqueo (Airbnb de Estacionamiento) - MVP

## 📝 Descripción del Sistema
Plataforma digital tipo marketplace diseñada para conectar a propietarios de espacios de parqueo (anfitriones) con conductores (huéspedes) que requieren estacionamiento por horas, días o periodos recurrentes. 

Este MVP corresponde al **Sprint 0** y se centra en los módulos fundamentales del sistema para garantizar la operatividad básica: registro e identidad, gestión de activos (vehículos) y publicación de la oferta (garajes).

## 🛠 Tecnologías Utilizadas
* **Backend:** Node.js, Express.
* **Base de Datos:** PostgreSQL (Librería `pg`).
* **Frontend:** HTML5, CSS3, JS Vanilla, Bootstrap 5 (vía CDN).
* **Control de Versiones y Colaboración:** Git, GitHub, Planner (Kanban).

## 👥 Aportes del Equipo y Ramas de Desarrollo
El proyecto se dividió utilizando metodologías ágiles, evidenciado en nuestro historial de Git mediante ramas (*branches*):
* **Desarrollador 1:** Configuración del entorno base y **CRUD de Perfiles y Accesos** (Registro y Login de usuarios).
* **Desarrollador 2:** **CRUD de Espacios de Parqueo** (Formulario de publicación y listado de garajes disponibles).
* **Desarrollador 3:** **CRUD de Vehículos** (Registro de vehículos vinculados al perfil del usuario mediante llaves foráneas).

## 🚀 Instrucciones de Configuración y Uso

### 1. Prerrequisitos
* Tener instalado Node.js (Versión LTS).
* Tener instalado PostgreSQL de forma local (pgAdmin 4).

### 2. Configuración de la Base de Datos
1. Abrir pgAdmin y crear una base de datos llamada `parqueo_airbnb`.
2. Abrir la herramienta *Query Tool* y ejecutar los scripts SQL proporcionados para crear las siguientes tablas en este orden:
   - Tabla `usuarios`
   - Tabla `espacios`
   - Tabla `vehiculos`
3. Verificar que las credenciales en el archivo `server.js` (`user`, `password`, `port`) coincidan con su entorno local.

### 3. Ejecución del Proyecto
1. Abrir la terminal en la carpeta del proyecto.
2. Instalar las dependencias ejecutando:
   \`\`\`bash
   npm install
   \`\`\`
3. Iniciar el servidor backend:
   \`\`\`bash
   node server.js
   \`\`\`
4. El servidor mostrará el mensaje de conexión exitosa. Abrir el navegador en la ruta:
   **http://localhost:3000** para utilizar la plataforma.
