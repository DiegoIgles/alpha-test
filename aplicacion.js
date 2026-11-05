'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { crearAlmacen, AlmacenSinConfigurar } = require('./almacen');
const { calcularResultado } = require('./puntaje');
const test = require('./catalogo/test.json');
const carreras = require('./catalogo/carreras.json');

const DIR_PUBLICO = path.join(__dirname, 'public');
const DIR_DATOS = process.env.DATA_DIR || path.join(__dirname, 'data');
const ARCHIVO_CLAVE = path.join(DIR_DATOS, 'admin-password.txt');
const DURACION_SESION_MS = 8 * 60 * 60 * 1000;
const LIMITE_CUERPO_BYTES = 16 * 1024;
const TOTAL_OFERTAS = carreras.reduce((total, carrera) => total + carrera.ofertas.length, 0);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const almacen = crearAlmacen(DIR_DATOS);
const intentos = new Map();
let claveEnMemoria = null;

function obtenerClaveAdmin() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.VERCEL) return null;
  if (claveEnMemoria) return claveEnMemoria;
  if (fs.existsSync(ARCHIVO_CLAVE)) {
    claveEnMemoria = fs.readFileSync(ARCHIVO_CLAVE, 'utf8').trim();
  } else {
    claveEnMemoria = crypto.randomBytes(9).toString('base64url');
    fs.mkdirSync(DIR_DATOS, { recursive: true });
    fs.writeFileSync(ARCHIVO_CLAVE, claveEnMemoria + '\n', { mode: 0o600 });
    console.log(`Contraseña de administrador generada: ${claveEnMemoria}`);
  }
  return claveEnMemoria;
}

function ipCliente(req) {
  // Vercel reemplaza esta cabecera, así que allí el cliente no puede falsificarla.
  if (process.env.VERCEL) return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return req.socket.remoteAddress;
}

function excedeLimite(clave, maximo, ventanaMs) {
  const ahora = Date.now();
  for (const [k, v] of intentos) if (v.reinicio < ahora) intentos.delete(k);
  const registro = intentos.get(clave) || { cantidad: 0, reinicio: ahora + ventanaMs };
  registro.cantidad += 1;
  intentos.set(clave, registro);
  return registro.cantidad > maximo;
}

function resumen(texto) {
  return crypto.createHash('sha256').update(texto).digest();
}

function firmar(expira, clave) {
  return crypto.createHmac('sha256', clave).update(String(expira)).digest('hex');
}

// La sesión va firmada en la cookie porque en Vercel cada solicitud puede atenderla una instancia distinta.
function crearTokenSesion(clave) {
  const expira = Date.now() + DURACION_SESION_MS;
  return `${expira}.${firmar(expira, clave)}`;
}

function esAdmin(req) {
  const clave = obtenerClaveAdmin();
  const coincidencia = /(?:^|;\s*)alpha_sesion=(\d+)\.([0-9a-f]{64})(?:;|$)/.exec(req.headers.cookie || '');
  if (!clave || !coincidencia) return false;
  const [, expira, firma] = coincidencia;
  return Number(expira) > Date.now()
    && crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(firmar(expira, clave)));
}

function cookieSesion(req, valor, maxAgeSegundos) {
  const segura = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `alpha_sesion=${valor}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSegundos}${segura}`;
}

function enviarJson(res, estado, datos, cabeceras = {}) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabeceras });
  res.end(JSON.stringify(datos));
}

class ErrorDeCliente extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

function leerJson(req) {
  return new Promise((resolve, reject) => {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) {
      reject(new ErrorDeCliente(415, 'Formato no admitido.'));
      req.resume();
      return;
    }
    const partes = [];
    let tamano = 0;
    let excedido = false;
    req.on('data', (parte) => {
      tamano += parte.length;
      if (tamano > LIMITE_CUERPO_BYTES) excedido = true;
      else partes.push(parte);
    });
    req.on('end', () => {
      if (excedido) return reject(new ErrorDeCliente(413, 'La solicitud es demasiado grande.'));
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8')));
      } catch {
        reject(new ErrorDeCliente(400, 'La solicitud no es válida.'));
      }
    });
    req.on('error', reject);
  });
}

function textoLimpio(valor, maximo) {
  if (typeof valor !== 'string') return '';
  return valor.replace(/\s+/g, ' ').trim().slice(0, maximo);
}

function validarEnvio(cuerpo) {
  const datos = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
  const fuente = datos.participante && typeof datos.participante === 'object' ? datos.participante : {};
  const nombre = textoLimpio(fuente.nombre, 100);
  const celular = textoLimpio(fuente.celular, 20);
  const colegio = textoLimpio(fuente.colegio, 120);
  const edad = Number(fuente.edad);

  if (nombre.length < 3) throw new ErrorDeCliente(400, 'Escribe tu nombre completo.');
  if (!Number.isInteger(edad) || edad < 10 || edad > 99) throw new ErrorDeCliente(400, 'Escribe una edad válida.');
  if (celular && !/^\+?[0-9 ()-]{6,20}$/.test(celular)) throw new ErrorDeCliente(400, 'Escribe un celular válido.');
  if (datos.consentimiento !== true) throw new ErrorDeCliente(400, 'Debes aceptar el uso de tus datos.');

  const lista = datos.respuestas;
  const completas = Array.isArray(lista)
    && lista.length === test.preguntas.length
    && lista.every((r) => Number.isInteger(r) && r >= 1 && r <= test.escala.length);
  if (!completas) throw new ErrorDeCliente(400, 'Responde todas las preguntas.');

  return { participante: { nombre, edad, celular, colegio }, respuestas: lista };
}

function filaCsv(celdas) {
  return celdas.map((celda) => {
    let texto = String(celda);
    if (/^[=+\-@\t\r]/.test(texto)) texto = "'" + texto;
    return `"${texto.replace(/"/g, '""')}"`;
  }).join(';');
}

function generarCsv(respuestas) {
  const letras = Object.keys(test.perfiles);
  const encabezado = [
    'Fecha', 'Nombre', 'Edad', 'Celular', 'Colegio',
    ...letras.map((letra) => `${test.perfiles[letra].nombre} %`),
    'Carreras recomendadas',
    ...test.preguntas.map((pregunta) => `P${pregunta.id}. ${pregunta.texto}`),
  ];
  const filas = respuestas.map((r) => [
    new Date(r.fecha).toLocaleString('es-BO', { timeZone: 'America/La_Paz' }), r.participante.nombre, r.participante.edad, r.participante.celular, r.participante.colegio,
    ...letras.map((letra) => r.resultado.perfiles.find((p) => p.letra === letra).porcentaje),
    r.resultado.carreras.map((c) => c.nombre).join(', '),
    ...r.respuestas.map((valor) => test.escala[valor - 1]),
  ]);
  return '﻿' + [encabezado, ...filas].map(filaCsv).join('\r\n');
}

async function atenderApi(req, res, ruta) {
  const ip = ipCliente(req);

  if (req.method === 'GET' && ruta === '/api/test') {
    return enviarJson(res, 200, {
      escala: test.escala,
      preguntas: test.preguntas.map(({ id, texto }) => ({ id, texto })),
      totalCarreras: carreras.length,
      totalOfertas: TOTAL_OFERTAS,
    });
  }

  if (req.method === 'POST' && ruta === '/api/respuestas') {
    if (excedeLimite(`envio:${ip}`, 120, 60 * 60 * 1000)) throw new ErrorDeCliente(429, 'Demasiados envíos. Intenta más tarde.');
    const envio = validarEnvio(await leerJson(req));
    const registro = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      ...envio,
      resultado: calcularResultado(envio.respuestas, test, carreras),
    };
    await almacen.agregar(registro);
    return enviarJson(res, 201, { resultado: registro.resultado });
  }

  if (req.method === 'POST' && ruta === '/api/admin/login') {
    if (excedeLimite(`login:${ip}`, 10, 15 * 60 * 1000)) throw new ErrorDeCliente(429, 'Demasiados intentos. Espera 15 minutos.');
    const cuerpo = await leerJson(req);
    const clave = obtenerClaveAdmin();
    if (!clave) throw new ErrorDeCliente(503, 'Falta configurar la contraseña de administrador (ADMIN_PASSWORD).');
    if (typeof cuerpo?.clave !== 'string' || !crypto.timingSafeEqual(resumen(cuerpo.clave), resumen(clave))) {
      throw new ErrorDeCliente(401, 'Contraseña incorrecta.');
    }
    return enviarJson(res, 200, { ok: true }, { 'Set-Cookie': cookieSesion(req, crearTokenSesion(clave), DURACION_SESION_MS / 1000) });
  }

  if (req.method === 'POST' && ruta === '/api/admin/logout') {
    return enviarJson(res, 200, { ok: true }, { 'Set-Cookie': cookieSesion(req, '', 0) });
  }

  if (!ruta.startsWith('/api/admin/')) throw new ErrorDeCliente(404, 'No encontrado.');
  if (!esAdmin(req)) throw new ErrorDeCliente(401, 'Inicia sesión para continuar.');

  if (req.method === 'GET' && ruta === '/api/admin/respuestas') {
    return enviarJson(res, 200, {
      escala: test.escala,
      preguntas: test.preguntas.map(({ id, texto, dim }) => ({ id, texto, perfil: test.perfiles[dim].nombre })),
      respuestas: [...await almacen.listar()].reverse(),
    });
  }

  if (req.method === 'GET' && ruta === '/api/admin/respuestas.csv') {
    const csv = generarCsv(await almacen.listar());
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="respuestas-alpha-academy.csv"',
      'Cache-Control': 'no-store',
    });
    return res.end(csv);
  }

  const borrado = /^\/api\/admin\/respuestas\/([0-9a-f-]{36})$/.exec(ruta);
  if (req.method === 'DELETE' && borrado) {
    if (!await almacen.eliminar(borrado[1])) throw new ErrorDeCliente(404, 'La respuesta ya no existe.');
    return enviarJson(res, 200, { ok: true });
  }

  throw new ErrorDeCliente(404, 'No encontrado.');
}

function atenderArchivo(req, res, ruta) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const relativa = ruta === '/' ? 'index.html' : ruta === '/admin' ? 'admin.html' : ruta.slice(1);
  const archivo = path.resolve(DIR_PUBLICO, relativa);
  const tipo = TIPOS[path.extname(archivo).toLowerCase()];
  if (!archivo.startsWith(DIR_PUBLICO + path.sep) || !tipo) {
    res.writeHead(404);
    return res.end();
  }
  fs.readFile(archivo, (error, contenido) => {
    if (error) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : contenido);
  });
}

async function manejador(req, res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  let ruta;
  try {
    const url = new URL(req.url, 'http://localhost');
    ruta = decodeURIComponent(url.pathname);
    // La reescritura de vercel.json puede entregar la ruta original en este parámetro.
    if (ruta === '/api/index') ruta = `/api/${url.searchParams.get('ruta') || ''}`;
  } catch {
    res.writeHead(400);
    return res.end();
  }

  if (!ruta.startsWith('/api/')) return atenderArchivo(req, res, ruta);
  try {
    await atenderApi(req, res, ruta);
  } catch (error) {
    if (error instanceof ErrorDeCliente) return enviarJson(res, error.estado, { error: error.message });
    if (error instanceof AlmacenSinConfigurar) {
      console.error(error.message);
      return enviarJson(res, 503, { error: 'El servicio aún no está configurado para guardar respuestas.' });
    }
    console.error(error);
    enviarJson(res, 500, { error: 'Ocurrió un error en el servidor. Intenta de nuevo.' });
  }
}

module.exports = { manejador, obtenerClaveAdmin, ARCHIVO_CLAVE };
