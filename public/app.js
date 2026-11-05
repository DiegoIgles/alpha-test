'use strict';

const CLAVE_PROGRESO = 'alpha-progreso';
const CLAVE_RESULTADO = 'alpha-resultado';
const ESPERA_AVANCE_MS = 220;

const $ = (id) => document.getElementById(id);
const vistas = { inicio: $('vista-inicio'), test: $('vista-test'), resultado: $('vista-resultado') };

let test = null;
let estado = null;
let temporizador = null;
let enviando = false;

function mostrarVista(nombre) {
  for (const [clave, vista] of Object.entries(vistas)) vista.hidden = clave !== nombre;
  window.scrollTo(0, 0);
}

function guardarProgreso() {
  sessionStorage.setItem(CLAVE_PROGRESO, JSON.stringify(estado));
}

function leerAlmacenado(clave) {
  try {
    return JSON.parse(sessionStorage.getItem(clave));
  } catch {
    return null;
  }
}

function validarFormulario(participante, acepta) {
  if (participante.nombre.trim().length < 3) return ['nombre', 'Escribe tu nombre completo.'];
  const edad = Number(participante.edad);
  if (!Number.isInteger(edad) || edad < 10 || edad > 99) return ['edad', 'Escribe una edad válida, entre 10 y 99 años.'];
  if (participante.celular.trim() && !/^\+?[0-9 ()-]{6,20}$/.test(participante.celular.trim())) return ['celular', 'Escribe un celular válido o déjalo vacío.'];
  if (!acepta) return ['consentimiento', 'Para continuar, marca la casilla de aceptación.'];
  return null;
}

function pintarPregunta() {
  const total = test.preguntas.length;
  const respondidas = estado.respuestas.filter(Boolean).length;
  const pregunta = test.preguntas[estado.indice];
  const seleccion = estado.respuestas[estado.indice];

  $('progreso-etiqueta').textContent = `Pregunta ${estado.indice + 1} de ${total}`;
  $('progreso-porcentaje').textContent = `${Math.round((respondidas / total) * 100)} %`;
  $('progreso-barra').style.width = `${(respondidas / total) * 100}%`;
  $('pregunta-texto').textContent = pregunta.texto;

  $('opciones').replaceChildren(...test.escala.map((texto, i) => {
    const valor = i + 1;
    const boton = crear('button', { type: 'button', className: 'opcion' },
      crear('span', { className: 'opcion-numero', textContent: valor }),
      crear('span', { textContent: texto }));
    boton.setAttribute('aria-pressed', String(seleccion === valor));
    boton.addEventListener('click', () => responder(valor));
    return boton;
  }));

  $('anterior').disabled = estado.indice === 0;
  $('enviar').hidden = respondidas < total;
  $('error-test').hidden = true;
}

function responder(valor) {
  estado.respuestas[estado.indice] = valor;
  guardarProgreso();
  pintarPregunta();
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    const siguiente = estado.respuestas.findIndex((r, i) => i > estado.indice && !r);
    const destino = siguiente !== -1 ? siguiente : estado.respuestas.indexOf(null);
    if (destino !== -1) irAPregunta(destino);
    else if (estado.indice < test.preguntas.length - 1) irAPregunta(estado.indice + 1);
    else $('enviar').focus();
  }, ESPERA_AVANCE_MS);
}

function irAPregunta(indice) {
  estado.indice = indice;
  guardarProgreso();
  pintarPregunta();
  $('pregunta-texto').focus({ preventScroll: true });
}

async function enviarTest() {
  if (enviando) return;
  enviando = true;
  $('enviar').disabled = true;
  mostrarError($('error-test'), '');
  try {
    const { resultado } = await enviarJson('/api/respuestas', {
      participante: estado.participante,
      consentimiento: true,
      respuestas: estado.respuestas,
    });
    const guardado = { nombre: estado.participante.nombre.trim(), resultado };
    sessionStorage.setItem(CLAVE_RESULTADO, JSON.stringify(guardado));
    sessionStorage.removeItem(CLAVE_PROGRESO);
    pintarResultado(guardado);
  } catch (error) {
    mostrarError($('error-test'), error.estado ? error.message : 'No hay conexión con el servidor. Tus respuestas siguen aquí; vuelve a intentarlo.');
  } finally {
    enviando = false;
    $('enviar').disabled = false;
  }
}

function tarjetaCarrera(carrera) {
  const ofertas = crear('ul', { className: 'ofertas' }, ...carrera.ofertas.map((oferta) => crear('li', {},
    crear('a', { href: oferta.url, target: '_blank', rel: 'noopener', textContent: oferta.facultad }),
    ...(oferta.nota ? [crear('span', { className: 'oferta-nota', textContent: ` · ${oferta.nota}` })] : []))));
  const resumen = carrera.ofertas.length === 1 ? 'Dónde estudiarla' : `Dónde estudiarla (${carrera.ofertas.length} facultades)`;

  return crear('li', { className: 'tarjeta carrera' },
    barraPorcentaje(carrera.nombre, carrera.afinidad),
    crear('details', {}, crear('summary', { textContent: resumen }), ofertas));
}

function pintarResultado({ nombre, resultado }) {
  const principales = resultado.perfiles.slice(0, 3);
  $('resultado-titulo').textContent = principales.map((p) => p.nombre).join(' · ');
  $('resultado-saludo').textContent = `${nombre}, estas son las áreas que más se acercan a tus intereses y las carreras relacionadas.`;
  $('resultado-parejo').hidden = !resultado.parejo;
  $('resultado-barras').replaceChildren(...resultado.perfiles.map((p) => barraPorcentaje(p.nombre, p.porcentaje)));
  $('resultado-perfiles').replaceChildren(...principales.map((p) => crear('div', { className: 'perfil' },
    crear('h3', { textContent: p.nombre }),
    crear('p', { textContent: p.descripcion }))));
  $('resultado-carreras').replaceChildren(...resultado.carreras.map(tarjetaCarrera));
  mostrarVista('resultado');
  $('resultado-titulo').focus({ preventScroll: true });
}

function reiniciar() {
  sessionStorage.removeItem(CLAVE_RESULTADO);
  sessionStorage.removeItem(CLAVE_PROGRESO);
  estado = null;
  $('formulario').reset();
  mostrarVista('inicio');
}

$('formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const participante = {
    nombre: $('nombre').value,
    edad: $('edad').value,
    celular: $('celular').value,
    colegio: $('colegio').value,
  };
  const problema = validarFormulario(participante, $('consentimiento').checked);
  if (problema) {
    mostrarError($('error-formulario'), problema[1]);
    $(problema[0]).focus();
    return;
  }
  if (!test) {
    mostrarError($('error-formulario'), 'No se pudo cargar el test. Recarga la página.');
    return;
  }
  mostrarError($('error-formulario'), '');
  estado = { participante, indice: 0, respuestas: test.preguntas.map(() => null) };
  guardarProgreso();
  mostrarVista('test');
  pintarPregunta();
});

$('anterior').addEventListener('click', () => {
  clearTimeout(temporizador);
  if (estado.indice > 0) irAPregunta(estado.indice - 1);
});
$('enviar').addEventListener('click', () => {
  clearTimeout(temporizador);
  enviarTest();
});
$('reiniciar').addEventListener('click', reiniciar);
$('imprimir').addEventListener('click', () => window.print());

window.addEventListener('beforeprint', () => {
  for (const detalle of document.querySelectorAll('details')) detalle.open = true;
});

document.addEventListener('keydown', (evento) => {
  if (vistas.test.hidden || evento.ctrlKey || evento.metaKey || evento.altKey) return;
  const valor = Number(evento.key);
  if (Number.isInteger(valor) && valor >= 1 && valor <= test.escala.length) responder(valor);
});

(async function iniciar() {
  try {
    test = await pedirJson('/api/test');
  } catch {
    mostrarError($('error-formulario'), 'No se pudo cargar el test. Recarga la página.');
    return;
  }
  $('dato-preguntas').textContent = test.preguntas.length;
  $('dato-carreras').textContent = test.totalCarreras;

  const resultado = leerAlmacenado(CLAVE_RESULTADO);
  const progreso = leerAlmacenado(CLAVE_PROGRESO);
  if (resultado) {
    pintarResultado(resultado);
  } else if (progreso && progreso.respuestas?.length === test.preguntas.length) {
    estado = progreso;
    mostrarVista('test');
    pintarPregunta();
  }
})();
