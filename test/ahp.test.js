const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const AHP = require("../ahp.js");

function assertMatrixClose(actual, expected, tol = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((row, i) => {
    assert.equal(row.length, expected[i].length);
    row.forEach((v, j) => assert.ok(Math.abs(v - expected[i][j]) <= tol, `matriz[${i}][${j}]: ${v} != ${expected[i][j]}`));
  });
}

test("calcAHP do exemplo: CR < 10% e pesos somam 1", () => {
  const r = AHP.calcAHP(AHP.EXAMPLE.critMatrix);
  assert.ok(r.CR < 0.10, `CR=${r.CR}`);
  assert.ok(Math.abs(r.weights.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test("matrizes do exemplo sao reciprocas", () => {
  const all = [AHP.EXAMPLE.critMatrix, ...Object.values(AHP.EXAMPLE.altMatrices)];
  all.forEach(M => M.forEach((row, i) => row.forEach((v, j) => {
    assert.ok(Math.abs(v * M[j][i] - 1) < 1e-9);
  })));
});

test("questionCount(4,3) === 18", () => {
  assert.equal(AHP.questionCount(4, 3), 18);
});

test("buildQuestionQueue gera uma pergunta por par", () => {
  const qs = AHP.buildQuestionQueue(AHP.EXAMPLE.criteria, AHP.EXAMPLE.alternatives);
  assert.equal(qs.length, AHP.questionCount(4, 3));
  assert.equal(qs.filter(q => q.type === "criteria").length, 6);
  assert.equal(qs.filter(q => q.type === "alt").length, 12);
});

test("findCycle detecta trio intransitivo", () => {
  assert.deepEqual(AHP.findCycle([[1, 3, 1 / 3], [1 / 3, 1, 3], [3, 1 / 3, 1]]), [0, 1, 2]);
  assert.equal(AHP.findCycle([[1, 1, 1], [1, 1, 1], [1, 1, 1]]), null);
});

test("sliderIndexToValue cobre toda a escala -4..4", () => {
  const esperado = [9, 7, 5, 3, 1, 1 / 3, 1 / 5, 1 / 7, 1 / 9];
  const obtido = [];
  for (let i = -4; i <= 4; i++) obtido.push(AHP.sliderIndexToValue(i));
  obtido.forEach((v, i) => assert.ok(Math.abs(v - esperado[i]) < 1e-12, `indice ${i - 4}: ${v}`));
});

test("describeAnswer nunca produz undefined para valores Saaty pares", () => {
  for (const v of [2, 4, 6, 8, 1 / 2, 1 / 4, 1 / 6, 1 / 8]) {
    const frase = AHP.describeAnswer({ a: "X", b: "Y" }, { v });
    assert.ok(!frase.includes("undefined"), `v=${v}: ${frase}`);
  }
});

test("describeAnswer preserva as palavras para valores impares", () => {
  const impares = [[3, "um pouco mais"], [5, "bem mais"], [7, "muito mais"], [9, "extremamente mais"]];
  for (const [v, palavra] of impares) {
    assert.ok(AHP.describeAnswer({ a: "X", b: "Y" }, { v }).includes(palavra));
    assert.ok(AHP.describeAnswer({ a: "X", b: "Y" }, { v: 1 / v }).includes(palavra));
  }
});

test("EXAMPLE espelha exemplo.json", () => {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "exemplo.json"), "utf8"));
  assert.equal(AHP.EXAMPLE.goal, json.objetivo);
  assert.deepEqual(AHP.EXAMPLE.criteria, json.criterios);
  assert.deepEqual(AHP.EXAMPLE.alternatives, json.alternativas);
  assertMatrixClose(AHP.EXAMPLE.critMatrix, json.matrizCriterios);
  assert.deepEqual(Object.keys(AHP.EXAMPLE.altMatrices).sort(), Object.keys(json.matrizesAlternativas).sort());
  for (const c of AHP.EXAMPLE.criteria) assertMatrixClose(AHP.EXAMPLE.altMatrices[c], json.matrizesAlternativas[c]);
});
