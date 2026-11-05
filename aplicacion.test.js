'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, test: prueba } = require('node:test');

const dirDatos = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-'));
process.env.DATA_DIR = dirDatos;
process.env.ADMIN_PASSWORD = 'clave-de-prueba';
delete process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;

const { manejador } = require('./aplicacion');

let servidor;
let base;

before(async () => {
  servidor = http.createServer(manejador);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => {
  servidor.close();
  fs.rmSync(dirDatos, { recursive: true, force: true });
});

const enviar = (ruta, cuerpo, cabeceras = {}) => fetch(base + ruta, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...cabeceras },
  body: JSON.stringify(cuerpo),
});

async function iniciarSesion() {
  const respuesta = await enviar('/api/admin/login', { clave: 'clave-de-prueba' });
  assert.strictEqual(respuesta.status, 200);
  return respuesta.headers.get('set-cookie').split(';')[0];
}

prueba('el panel rechaza sesiones ausentes, falsificadas o vencidas', async () => {
  const pedir = (cookie) => fetch(`${base}/api/admin/respuestas`, { headers: cookie ? { cookie } : {} });
  assert.strictEqual((await pedir()).status, 401);
  assert.strictEqual((await pedir(`alpha_sesion=${Date.now() + 100000}.${'0'.repeat(64)}`)).status, 401);

  const valida = await iniciarSesion();
  const firma = valida.split('.')[1];
  assert.strictEqual((await pedir(`alpha_sesion=${Date.now() + 100000}.${firma}`)).status, 401);
  assert.strictEqual((await pedir(`alpha_sesion=1.${firma}`)).status, 401);
  assert.strictEqual((await pedir(valida)).status, 200);
});

prueba('una respuesta enviada se guarda, aparece en el panel y se puede eliminar', async () => {
  const creada = await enviar('/api/respuestas', {
    participante: { nombre: 'Ana Paz', edad: 17 },
    consentimiento: true,
    respuestas: Array(36).fill(3),
  });
  assert.strictEqual(creada.status, 201);

  const cookie = await iniciarSesion();
  const { respuestas } = await (await fetch(`${base}/api/admin/respuestas`, { headers: { cookie } })).json();
  assert.strictEqual(respuestas[0].participante.nombre, 'Ana Paz');

  const borrar = () => fetch(`${base}/api/admin/respuestas/${respuestas[0].id}`, { method: 'DELETE', headers: { cookie } });
  assert.strictEqual((await borrar()).status, 200);
  assert.strictEqual((await borrar()).status, 404);
});

prueba('una contraseña incorrecta no inicia sesión', async () => {
  const respuesta = await enviar('/api/admin/login', { clave: 'otra' });
  assert.strictEqual(respuesta.status, 401);
  assert.strictEqual(respuesta.headers.get('set-cookie'), null);
});
