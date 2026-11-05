'use strict';

const http = require('node:http');
const { manejador, obtenerClaveAdmin, ARCHIVO_CLAVE } = require('./aplicacion');

const PUERTO = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

obtenerClaveAdmin();

http.createServer(manejador).listen(PUERTO, HOST, () => {
  console.log(`ALPHA ACADEMY en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PUERTO}`);
  console.log(`Panel de administración: /admin (contraseña en ${process.env.ADMIN_PASSWORD ? 'ADMIN_PASSWORD' : ARCHIVO_CLAVE})`);
});
