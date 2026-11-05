'use strict';

const assert = require('node:assert');
const { test: prueba } = require('node:test');

class BlobNotFoundError extends Error {}

const archivos = new Map();
const llamadas = { get: 0 };
const blobFalso = {
  BlobNotFoundError,
  async put(ruta, cuerpo, opciones) {
    assert.strictEqual(opciones.access, 'private');
    archivos.set(ruta, cuerpo);
  },
  async list({ prefix, cursor }) {
    const rutas = [...archivos.keys()].filter((ruta) => ruta.startsWith(prefix)).sort();
    const inicio = Number(cursor || 0);
    const fin = inicio + 2;
    return {
      blobs: rutas.slice(inicio, fin).map((pathname) => ({ pathname })),
      hasMore: fin < rutas.length,
      cursor: String(fin),
    };
  },
  async get(ruta, opciones) {
    assert.strictEqual(opciones.access, 'private');
    llamadas.get += 1;
    if (!archivos.has(ruta)) return null;
    return { statusCode: 200, stream: new Blob([archivos.get(ruta)]).stream() };
  },
  async head(ruta) {
    if (!archivos.has(ruta)) throw new BlobNotFoundError();
    return {};
  },
  async del(ruta) {
    archivos.delete(ruta);
  },
};

require.cache[require.resolve('@vercel/blob')] = { id: '@vercel/blob', loaded: true, exports: blobFalso };

const { crearAlmacen, AlmacenSinConfigurar } = require('./almacen');

function conEntorno(variables, fn) {
  const previas = {};
  for (const clave of Object.keys(variables)) {
    previas[clave] = process.env[clave];
    if (variables[clave] === undefined) delete process.env[clave];
    else process.env[clave] = variables[clave];
  }
  try {
    return fn();
  } finally {
    for (const [clave, valor] of Object.entries(previas)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
}

const SIN_BLOB = { BLOB_STORE_ID: undefined, BLOB_READ_WRITE_TOKEN: undefined };

prueba('Blob guarda, lista por páginas en orden de fecha y elimina', async () => {
  const almacen = conEntorno({ BLOB_STORE_ID: 'store_x' }, () => crearAlmacen('sin-uso'));
  const id = (n) => `0000000${n}-0000-4000-8000-000000000000`;
  await almacen.agregar({ id: id(1), fecha: '2026-01-03T00:00:00.000Z' });
  await almacen.agregar({ id: id(2), fecha: '2026-01-01T00:00:00.000Z' });
  await almacen.agregar({ id: id(3), fecha: '2026-01-02T00:00:00.000Z' });

  assert.deepStrictEqual((await almacen.listar()).map((r) => r.id), [id(2), id(3), id(1)]);

  const lecturas = llamadas.get;
  await almacen.listar();
  assert.strictEqual(llamadas.get, lecturas, 'no debe releer respuestas ya conocidas');

  assert.strictEqual(await almacen.eliminar(id(3)), true);
  assert.strictEqual(await almacen.eliminar(id(3)), false);
  assert.deepStrictEqual((await almacen.listar()).map((r) => r.id), [id(2), id(1)]);
});

prueba('en Vercel sin almacén conectado avisa en lugar de escribir en disco', async () => {
  const almacen = conEntorno({ ...SIN_BLOB, VERCEL: '1' }, () => crearAlmacen('sin-uso'));
  await assert.rejects(almacen.listar(), AlmacenSinConfigurar);
  await assert.rejects(almacen.agregar({}), AlmacenSinConfigurar);
});
