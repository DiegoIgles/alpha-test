'use strict';

// Muestra public/logo.png cuando existe; si no, queda visible el espacio reservado.
for (const contenedor of document.querySelectorAll('[data-logo]')) {
  const imagen = contenedor.querySelector('img');
  imagen.addEventListener('load', () => {
    imagen.hidden = false;
    contenedor.classList.add('con-imagen');
  });
  imagen.src = '/logo.png';
}

function crear(etiqueta, propiedades = {}, ...hijos) {
  const elemento = document.createElement(etiqueta);
  Object.assign(elemento, propiedades);
  elemento.append(...hijos);
  return elemento;
}

function barraPorcentaje(etiqueta, valor, textoValor = `${valor} %`, maximo = 100) {
  const relleno = crear('div', { className: 'relleno' });
  relleno.style.width = `${maximo ? (valor / maximo) * 100 : 0}%`;
  return crear('div', { className: 'barra', title: `${etiqueta}: ${textoValor}` },
    crear('div', { className: 'barra-texto' },
      crear('span', { textContent: etiqueta }),
      crear('span', { className: 'barra-valor', textContent: textoValor })),
    crear('div', { className: 'pista' }, relleno));
}

async function pedirJson(url, opciones = {}) {
  const respuesta = await fetch(url, opciones);
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.error || 'No se pudo completar la solicitud.');
    error.estado = respuesta.status;
    throw error;
  }
  return datos;
}

function enviarJson(url, cuerpo) {
  return pedirJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

function mostrarError(elemento, mensaje) {
  elemento.textContent = mensaje || '';
  elemento.hidden = !mensaje;
}
