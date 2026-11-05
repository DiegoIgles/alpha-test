'use strict';

const $ = (id) => document.getElementById(id);
const formatoFecha = new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' });

let datos = null;
let seleccion = null;

function mostrarPanel(activo) {
  $('vista-login').hidden = activo;
  $('vista-panel').hidden = !activo;
  $('salir').hidden = !activo;
}

function masFrecuente(valores) {
  const conteo = new Map();
  for (const valor of valores) conteo.set(valor, (conteo.get(valor) || 0) + 1);
  return [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
}

function pintarEstadisticas() {
  const lista = datos.respuestas;
  const perfiles = masFrecuente(lista.map((r) => r.resultado.perfiles[0].nombre));
  const carreras = masFrecuente(lista.map((r) => r.resultado.carreras[0].nombre));
  $('stat-total').textContent = lista.length;
  $('stat-perfil').textContent = perfiles[0]?.[0] ?? 'Sin datos';
  $('stat-carrera').textContent = carreras[0]?.[0] ?? 'Sin datos';
  $('bloque-distribucion').hidden = lista.length === 0;
  const maximo = perfiles[0]?.[1] ?? 0;
  $('distribucion').replaceChildren(...perfiles.map(([nombre, cantidad]) => barraPorcentaje(nombre, cantidad, String(cantidad), maximo)));
}

function pintarFilas() {
  const filtro = $('buscar').value.trim().toLocaleLowerCase('es');
  const filas = datos.respuestas.filter((r) => {
    if (!filtro) return true;
    return `${r.participante.nombre} ${r.participante.colegio}`.toLocaleLowerCase('es').includes(filtro);
  });

  $('filas').replaceChildren(...filas.map((r) => {
    const ver = crear('button', { type: 'button', className: 'boton-texto', textContent: 'Ver respuestas' });
    ver.setAttribute('aria-label', `Ver respuestas de ${r.participante.nombre}`);
    ver.addEventListener('click', () => abrirDetalle(r));
    return crear('tr', {},
      crear('td', { className: 'sin-salto', textContent: formatoFecha.format(new Date(r.fecha)) }),
      crear('td', { textContent: r.participante.nombre }),
      crear('td', { textContent: r.participante.edad }),
      crear('td', { textContent: r.participante.colegio || '—' }),
      crear('td', { textContent: r.resultado.perfiles[0].nombre }),
      crear('td', { textContent: r.resultado.carreras[0].nombre }),
      crear('td', {}, ver));
  }));

  const hay = datos.respuestas.length > 0;
  $('sin-filas').textContent = hay ? 'Ninguna respuesta coincide con la búsqueda.' : 'Todavía nadie ha respondido el test.';
  $('sin-filas').hidden = filas.length > 0;
}

function abrirDetalle(registro) {
  seleccion = registro;
  const { participante, resultado } = registro;
  $('detalle-nombre').textContent = participante.nombre;
  $('detalle-datos').textContent = [
    `${participante.edad} años`,
    participante.celular && `Celular: ${participante.celular}`,
    participante.colegio && `Colegio: ${participante.colegio}`,
    formatoFecha.format(new Date(registro.fecha)),
  ].filter(Boolean).join(' · ');
  $('detalle-barras').replaceChildren(...resultado.perfiles.map((p) => barraPorcentaje(p.nombre, p.porcentaje)));
  $('detalle-carreras').replaceChildren(...resultado.carreras.map((c) => crear('li', { textContent: `${c.nombre} (${c.afinidad} %)` })));
  $('detalle-respuestas').replaceChildren(...datos.preguntas.map((pregunta, i) => crear('tr', {},
    crear('td', { textContent: pregunta.id }),
    crear('td', { textContent: pregunta.texto }),
    crear('td', { textContent: pregunta.perfil }),
    crear('td', { textContent: datos.escala[registro.respuestas[i] - 1] }))));
  $('detalle').showModal();
}

async function cargar() {
  try {
    datos = await pedirJson('/api/admin/respuestas');
  } catch (error) {
    if (error.estado === 401) {
      mostrarPanel(false);
      $('clave').focus();
      return;
    }
    mostrarPanel(true);
    mostrarError($('error-panel'), error.message);
    return;
  }
  mostrarPanel(true);
  mostrarError($('error-panel'), '');
  pintarEstadisticas();
  pintarFilas();
}

$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError($('error-login'), '');
  try {
    await enviarJson('/api/admin/login', { clave: $('clave').value });
    $('clave').value = '';
    await cargar();
  } catch (error) {
    mostrarError($('error-login'), error.message);
  }
});

$('salir').addEventListener('click', async () => {
  await enviarJson('/api/admin/logout', {}).catch(() => {});
  datos = null;
  mostrarPanel(false);
});

$('buscar').addEventListener('input', pintarFilas);
$('detalle-cerrar').addEventListener('click', () => $('detalle').close());

$('detalle-eliminar').addEventListener('click', async () => {
  if (!window.confirm(`¿Eliminar la respuesta de ${seleccion.participante.nombre}? Esta acción no se puede deshacer.`)) return;
  try {
    await pedirJson(`/api/admin/respuestas/${seleccion.id}`, { method: 'DELETE' });
    $('detalle').close();
    await cargar();
  } catch (error) {
    $('detalle').close();
    mostrarError($('error-panel'), error.message);
  }
});

cargar();
