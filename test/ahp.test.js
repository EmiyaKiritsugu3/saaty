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

test("buildQuestionQueue contem cada par exatamente uma vez", () => {
  const crit = AHP.EXAMPLE.criteria, alts = AHP.EXAMPLE.alternatives;
  const qs = AHP.buildQuestionQueue(crit, alts);
  const keys = qs.map(q => `${q.type}:${q.cj ?? -1}:${Math.min(q.i, q.j)}:${Math.max(q.i, q.j)}`);
  assert.equal(new Set(keys).size, keys.length);
  const esperado = new Set();
  for (let i = 0; i < crit.length; i++)
    for (let j = i + 1; j < crit.length; j++) esperado.add(`criteria:-1:${i}:${j}`);
  crit.forEach((_, cj) => {
    for (let i = 0; i < alts.length; i++)
      for (let j = i + 1; j < alts.length; j++) esperado.add(`alt:${cj}:${i}:${j}`);
  });
  assert.deepEqual(new Set(keys), esperado);
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

test("describeAnswer descreve valores pares com a palavra e o vencedor certos", () => {
  const esperado = [
    [2, "X um pouco mais importante que Y"],
    [4, "X bem mais importante que Y"],
    [6, "X muito mais importante que Y"],
    [8, "X extremamente mais importante que Y"],
    [1 / 2, "Y um pouco mais importante que X"],
    [1 / 4, "Y bem mais importante que X"],
    [1 / 6, "Y muito mais importante que X"],
    [1 / 8, "Y extremamente mais importante que X"],
  ];
  for (const [v, frase] of esperado) {
    const obtido = AHP.describeAnswer({ a: "X", b: "Y" }, { v });
    assert.ok(!obtido.includes("undefined"), `v=${v}: ${obtido}`);
    assert.equal(obtido, frase, `v=${v}`);
  }
});

test("describeAnswer preserva as palavras para valores impares", () => {
  const impares = [[3, "um pouco mais"], [5, "bem mais"], [7, "muito mais"], [9, "extremamente mais"]];
  for (const [v, palavra] of impares) {
    assert.ok(AHP.describeAnswer({ a: "X", b: "Y" }, { v }).includes(palavra));
    assert.ok(AHP.describeAnswer({ a: "X", b: "Y" }, { v: 1 / v }).includes(palavra));
  }
});

test("magnitudeParts resolve magnitude e vencedor para todo indice", () => {
  assert.deepEqual(AHP.magnitudeParts(0, "A", "B"), { tie: true });
  assert.deepEqual(AHP.magnitudeParts(-1, "A", "B"), { tie: false, mag: 3, winner: "A", loser: "B" });
  assert.deepEqual(AHP.magnitudeParts(1, "A", "B"), { tie: false, mag: 3, winner: "B", loser: "A" });
  assert.deepEqual(AHP.magnitudeParts(-4, "A", "B"), { tie: false, mag: 9, winner: "A", loser: "B" });
  assert.deepEqual(AHP.magnitudeParts(4, "A", "B"), { tie: false, mag: 9, winner: "B", loser: "A" });
});

test("restoreState rejeita storage parcialmente corrompido", () => {
  const payload = {
    step: 5, goal: "x", criteria: ["A", "B"], alternatives: ["X", "Y"],
    critMatrix: [[1, 1], [1, 1]],
    altMatrices: { A: [[1, 1], [1, 1]], B: [[1, 1], [1, 1]] },
    answers: [null], // tamanho errado: estado misto
    qIndex: 0, queueDims: { nCrit: 2, nAlt: 2 }, phase: "ask",
  };
  global.localStorage = { getItem: () => JSON.stringify(payload), setItem: () => {} };
  try {
    assert.equal(AHP.restoreState(), false);
  } finally {
    delete global.localStorage;
  }
});

test("restoreState rejeita resultado step 5 com respostas incompletas", () => {
  const payload = {
    step: 5, goal: "x", criteria: ["A", "B"], alternatives: ["X", "Y"],
    critMatrix: [[1, 1], [1, 1]],
    altMatrices: { A: [[1, 1], [1, 1]], B: [[1, 1], [1, 1]] },
    answers: [{ v: 1 }, { v: 1 }, null], // tamanho certo, mas uma resposta falta
    qIndex: 0, queueDims: { nCrit: 2, nAlt: 2 }, phase: "ask",
  };
  global.localStorage = { getItem: () => JSON.stringify(payload), setItem: () => {} };
  try {
    assert.equal(AHP.restoreState(), false);
  } finally {
    delete global.localStorage;
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
