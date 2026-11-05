'use strict';

const PESOS_CODIGO = [0.5, 0.3, 0.2];
const CARRERAS_EN_RESULTADO = 8;
const DIFERENCIA_PERFIL_PAREJO = 15;

// Convierte las respuestas (1 a 5) en un porcentaje por perfil y ordena las carreras por afinidad.
function calcularResultado(respuestas, test, carreras) {
  const puntos = {};
  const cantidad = {};
  test.preguntas.forEach((pregunta, i) => {
    puntos[pregunta.dim] = (puntos[pregunta.dim] || 0) + (respuestas[i] - 1);
    cantidad[pregunta.dim] = (cantidad[pregunta.dim] || 0) + 1;
  });

  const porcentajes = {};
  for (const letra of Object.keys(test.perfiles)) {
    porcentajes[letra] = (puntos[letra] / (cantidad[letra] * 4)) * 100;
  }

  const perfiles = Object.keys(test.perfiles)
    .map((letra) => ({
      letra,
      nombre: test.perfiles[letra].nombre,
      descripcion: test.perfiles[letra].descripcion,
      porcentaje: Math.round(porcentajes[letra]),
    }))
    .sort((a, b) => porcentajes[b.letra] - porcentajes[a.letra]);

  const afinidades = carreras
    .map((carrera) => ({
      nombre: carrera.nombre,
      exacta: [...carrera.codigo].reduce((total, letra, i) => total + porcentajes[letra] * PESOS_CODIGO[i], 0),
      ofertas: carrera.ofertas,
    }))
    .sort((a, b) => b.exacta - a.exacta || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, CARRERAS_EN_RESULTADO)
    .map(({ nombre, exacta, ofertas }) => ({ nombre, afinidad: Math.round(exacta), ofertas }));

  const valores = Object.values(porcentajes);
  return {
    perfiles,
    carreras: afinidades,
    parejo: Math.max(...valores) - Math.min(...valores) < DIFERENCIA_PERFIL_PAREJO,
  };
}

module.exports = { calcularResultado };
