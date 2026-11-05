'use strict';

const assert = require('node:assert');
const { test: prueba } = require('node:test');
const { calcularResultado } = require('./puntaje');
const test = require('./catalogo/test.json');
const carreras = require('./catalogo/carreras.json');

const respuestasCon = (fn) => test.preguntas.map(fn);

prueba('el catálogo conserva las 98 ofertas y cada carrera tiene un código válido', () => {
  assert.strictEqual(carreras.reduce((total, c) => total + c.ofertas.length, 0), 98);
  for (const carrera of carreras) assert.match(carrera.codigo, /^[RIASEC]{3}$/, carrera.nombre);
});

prueba('hay seis preguntas por perfil', () => {
  for (const letra of Object.keys(test.perfiles)) {
    assert.strictEqual(test.preguntas.filter((p) => p.dim === letra).length, 6);
  }
});

prueba('los extremos dan 100 % y 0 %', () => {
  const r = calcularResultado(respuestasCon((p) => (p.dim === 'I' ? 5 : 1)), test, carreras);
  assert.strictEqual(r.perfiles[0].letra, 'I');
  assert.strictEqual(r.perfiles[0].porcentaje, 100);
  assert.strictEqual(r.perfiles[5].porcentaje, 0);
  assert.strictEqual(r.parejo, false);
});

prueba('cada perfil dominante recomienda una carrera acorde', () => {
  const esperadas = { R: 'Ingeniería', I: 'Biología', A: 'Arquitectura', S: 'Ciencias de la Educación', E: 'Administración', C: 'Contaduría' };
  for (const [letra, carrera] of Object.entries(esperadas)) {
    const r = calcularResultado(respuestasCon((p) => (p.dim === letra ? 5 : 1)), test, carreras);
    assert.ok(r.carreras.some((c) => c.nombre.includes(carrera)), `${letra}: ${r.carreras.map((c) => c.nombre)}`);
    assert.strictEqual(r.carreras.length, 8);
  }
});

prueba('marca como parejo a quien responde lo mismo en todo', () => {
  assert.strictEqual(calcularResultado(respuestasCon(() => 3), test, carreras).parejo, true);
});
