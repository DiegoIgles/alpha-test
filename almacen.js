'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PREFIJO_BLOB = 'respuestas/';
const LECTURAS_SIMULTANEAS = 10;

class AlmacenSinConfigurar extends Error {}

function almacenEnArchivo(dirDatos) {
  const archivo = path.join(dirDatos, 'respuestas.json');
  let registros = null;

  function cargar() {
    if (registros) return registros;
    fs.mkdirSync(dirDatos, { recursive: true });
    registros = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, 'utf8')) : [];
    return registros;
  }

  function guardar() {
    const temporal = archivo + '.tmp';
    fs.writeFileSync(temporal, JSON.stringify(registros, null, 1));
    fs.renameSync(temporal, archivo);
  }

  return {
    async listar() {
      return cargar();
    },
    async agregar(registro) {
      cargar().push(registro);
      guardar();
    },
    async eliminar(id) {
      const indice = cargar().findIndex((r) => r.id === id);
      if (indice === -1) return false;
      registros.splice(indice, 1);
      guardar();
      return true;
    },
  };
}

// Un archivo por respuesta: así dos envíos simultáneos no pueden pisarse.
function almacenEnBlob() {
  const { put, list, get, head, del, BlobNotFoundError } = require('@vercel/blob');
  const rutaDe = (id) => `${PREFIJO_BLOB}${id}.json`;
  const leidos = new Map(); // Las respuestas no cambian; evita gastar lecturas del plan.

  async function leer(pathname) {
    if (leidos.has(pathname)) return leidos.get(pathname);
    const resultado = await get(pathname, { access: 'private' });
    if (resultado?.statusCode !== 200) return null;
    const registro = JSON.parse(await new Response(resultado.stream).text());
    leidos.set(pathname, registro);
    return registro;
  }

  return {
    async listar() {
      const rutas = [];
      let cursor;
      do {
        const pagina = await list({ prefix: PREFIJO_BLOB, cursor });
        rutas.push(...pagina.blobs.map((blob) => blob.pathname));
        cursor = pagina.hasMore ? pagina.cursor : undefined;
      } while (cursor);

      const registros = [];
      for (let i = 0; i < rutas.length; i += LECTURAS_SIMULTANEAS) {
        registros.push(...await Promise.all(rutas.slice(i, i + LECTURAS_SIMULTANEAS).map(leer)));
      }
      return registros.filter(Boolean).sort((a, b) => a.fecha.localeCompare(b.fecha));
    },
    async agregar(registro) {
      await put(rutaDe(registro.id), JSON.stringify(registro), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
    },
    async eliminar(id) {
      const ruta = rutaDe(id);
      try {
        await head(ruta);
      } catch (error) {
        if (error instanceof BlobNotFoundError) return false;
        throw error;
      }
      await del(ruta);
      leidos.delete(ruta);
      return true;
    },
  };
}

function almacenSinConfigurar() {
  const fallar = async () => {
    throw new AlmacenSinConfigurar('Falta conectar un almacén privado de Vercel Blob al proyecto.');
  };
  return { listar: fallar, agregar: fallar, eliminar: fallar };
}

function crearAlmacen(dirDatos) {
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) return almacenEnBlob();
  // En Vercel el disco es de solo lectura y no se conserva entre ejecuciones.
  return process.env.VERCEL ? almacenSinConfigurar() : almacenEnArchivo(dirDatos);
}

module.exports = { crearAlmacen, AlmacenSinConfigurar };
