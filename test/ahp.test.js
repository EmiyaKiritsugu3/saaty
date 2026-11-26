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

function setupAnsweredState(S, overrides = {}) {
  const criteria = overrides.criteria || ["A", "B"];
  const alternatives = overrides.alternatives || ["X", "Y"];
  const questions = AHP.buildQuestionQueue(criteria, alternatives);
  const answers = overrides.answers || questions.map((_, i) => ({ v: i + 1 }));
  Object.assign(S, {
    step: 2, goal: "Teste", criteria, alternatives, questions, answers,
    queueDims: { nCrit: criteria.length, nAlt: alternatives.length },
    qIndex: 0, correction: null, sliderIdx: 0, sliderTouched: false,
    pendingNudge: null, phase: "ask", result: null, structuralAdd: null,
    ...overrides,
  });
  AHP.__test.ensureMatrices();
  questions.forEach((q, i) => {
    if (!answers[i]) return;
    const M = q.type === "criteria" ? S.critMatrix : S.altMatrices[q.crit];
    M[q.i][q.j] = answers[i].v;
    M[q.j][q.i] = 1 / answers[i].v;
  });
  return { criteria, alternatives, questions, answers };
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

test("answerValueForSave preserva valor fora da grade quando o slider nao foi tocado", () => {
  assert.equal(AHP.answerValueForSave({ v: 2 }, false, -1), 2);
  assert.equal(AHP.answerValueForSave({ v: 4 }, false, -2), 4);
  assert.equal(AHP.answerValueForSave({ v: 2 }, true, -1), 3);
  assert.equal(AHP.answerValueForSave(null, false, 0), 1);
});

test("answersFromMatrices reconstrói o exemplo e matricesFromAnswers devolve as matrizes originais", () => {
  const answers = AHP.answersFromMatrices(
    AHP.EXAMPLE.criteria,
    AHP.EXAMPLE.alternatives,
    AHP.EXAMPLE.critMatrix,
    AHP.EXAMPLE.altMatrices,
  );
  assert.equal(answers.length, AHP.questionCount(4, 3));
  const rebuilt = AHP.matricesFromAnswers(AHP.EXAMPLE.criteria, AHP.EXAMPLE.alternatives, answers);
  assertMatrixClose(rebuilt.critMatrix, AHP.EXAMPLE.critMatrix);
  for (const c of AHP.EXAMPLE.criteria) {
    assertMatrixClose(rebuilt.altMatrices[c], AHP.EXAMPLE.altMatrices[c]);
  }
});

test("restoreState restaura resultado do exemplo salvo como respostas", () => {
  const answers = AHP.answersFromMatrices(
    AHP.EXAMPLE.criteria,
    AHP.EXAMPLE.alternatives,
    AHP.EXAMPLE.critMatrix,
    AHP.EXAMPLE.altMatrices,
  );
  const payload = {
    step: 5, goal: AHP.EXAMPLE.goal,
    criteria: AHP.EXAMPLE.criteria, alternatives: AHP.EXAMPLE.alternatives,
    answers, qIndex: 0, queueDims: { nCrit: 4, nAlt: 3 }, phase: "ask",
    correction: null, sliderIdx: 0, sliderTouched: false,
  };
  global.localStorage = { getItem: () => JSON.stringify(payload), setItem: () => {} };
  try {
    assert.equal(AHP.restoreState(), true);
    assert.equal(AHP.__test.state.step, 5);
    assert.equal(AHP.__test.state.questions.length, 18);
    assert.equal(AHP.__test.state.result.ranking[0].alt, "Carro C");
  } finally {
    delete global.localStorage;
  }
});

test("restoreState preserva respostas depois de renomear criterio", () => {
  const criteria = ["Custo2", "Conforto", "Economia"];
  const alternatives = ["A", "B", "C"];
  const answers = AHP.buildQuestionQueue(criteria, alternatives).map((_, i) => (i < 3 ? { v: 3 } : null));
  const payload = {
    step: 3, goal: "Teste", criteria, alternatives, answers,
    qIndex: 0, queueDims: { nCrit: 3, nAlt: 3 }, phase: "ask",
    correction: null, sliderIdx: 0, sliderTouched: false,
  };
  global.localStorage = { getItem: () => JSON.stringify(payload), setItem: () => {} };
  try {
    assert.equal(AHP.restoreState(), true);
    assert.equal(AHP.__test.state.answers[0].v, 3);
    assert.equal(AHP.__test.state.answers[3], null);
    assert.deepEqual(AHP.__test.state.queueDims, { nCrit: 3, nAlt: 3 });
  } finally {
    delete global.localStorage;
  }
});

test("mudanca estrutural limpa respostas para nao reutilizar julgamentos antigos", () => {
  const S = AHP.__test.state;
  const criteria = ["A", "B", "C"];
  const alternatives = ["X", "Y"];
  const questions = AHP.buildQuestionQueue(criteria, alternatives);
  Object.assign(S, {
    step: 3, goal: "Teste", criteria, alternatives, questions,
    answers: questions.map((_, i) => (i < 3 ? { v: 9 } : null)),
    queueDims: { nCrit: 3, nAlt: 2 }, qIndex: 0, correction: null,
    sliderIdx: 0, sliderTouched: false, pendingNudge: null, phase: "ask", result: null,
  });
  AHP.__test.ensureMatrices();
  AHP.__test.invalidateAnswers();
  assert.ok(S.answers.every(a => a === null));
  assert.equal(S.queueDims, null);
  AHP.__test.ensureMatrices();
  AHP.__test.startQuestions();
  // Snapshot obsoleto: dimensões diferentes e respostas preenchidas. Se o
  // guard de dimensões de restoreFlow cair, este teste falha.
  AHP.__test.restoreFlow({ nCrit: 3, nAlt: 3, answers: S.questions.map(() => ({ v: 9 })) });
  assert.ok(S.answers.every(a => a === null));
  assert.equal(S.qIndex, 0);
});

test("snapshot/restore preserva respostas quando apenas os nomes mudam", () => {
  const S = AHP.__test.state;
  const criteria = ["A", "B"];
  const alternatives = ["X", "Y"];
  const questions = AHP.buildQuestionQueue(criteria, alternatives);
  const answers = questions.map((_, i) => ({ v: i + 1 }));
  Object.assign(S, {
    step: 3, goal: "Teste", criteria, alternatives, questions, answers,
    queueDims: { nCrit: 2, nAlt: 2 }, qIndex: 0, correction: null,
    sliderIdx: 0, sliderTouched: false, pendingNudge: null, phase: "ask", result: null,
  });
  AHP.__test.ensureMatrices();
  questions.forEach((q, i) => {
    const M = q.type === "criteria" ? S.critMatrix : S.altMatrices[q.crit];
    M[q.i][q.j] = answers[i].v;
    M[q.j][q.i] = 1 / answers[i].v;
  });
  const snap = AHP.__test.snapshotFlow();
  S.criteria = ["A2", "B"];
  AHP.__test.ensureMatrices();
  AHP.__test.startQuestions();
  AHP.__test.restoreFlow(snap);
  assert.equal(S.answers[0].v, 1);
  assert.equal(S.questions[0].a, "A2");
  assert.equal(S.qIndex, 0);
});

test("adicao preenchida invalida respostas ao continuar", () => {
  const S = AHP.__test.state;
  setupAnsweredState(S, { structuralAdd: [{ kind: "crit", start: 2 }] });
  AHP.__test.consumeStructuralAdd("crit", ["A", "B", "C"]);
  assert.ok(S.answers.every(a => a === null));
  assert.equal(S.queueDims, null);
  assert.equal(S.structuralAdd, null);
});

test("adicao em branco mantem respostas ao continuar", () => {
  const S = AHP.__test.state;
  setupAnsweredState(S, { structuralAdd: [{ kind: "crit", start: 2 }] });
  AHP.__test.consumeStructuralAdd("crit", ["A", "B", ""]);
  assert.equal(S.answers.filter(Boolean).length, 3);
  assert.deepEqual(S.queueDims, { nCrit: 2, nAlt: 2 });
  assert.equal(S.structuralAdd, null);
});

test("consumir uma lista preserva a adicao pendente da outra", () => {
  const S = AHP.__test.state;
  setupAnsweredState(S, { step: 3, structuralAdd: [{ kind: "alt", start: 2 }] });
  assert.equal(AHP.__test.consumeStructuralAdd("crit", ["A", "B"]), false);
  assert.deepEqual(S.structuralAdd, [{ kind: "alt", start: 2 }]);
  assert.equal(AHP.__test.consumeStructuralAdd("alt", ["X", "Y", "Z"]), true);
  assert.ok(S.answers.every(a => a === null));
  assert.equal(S.structuralAdd, null);
});

test("restoreState mantem linhas em branco no editor e dimensiona a fila pelo conteudo preenchido", () => {
  const criteria = ["A", "B", ""];
  const alternatives = ["X", "Y"];
  const answers = AHP.buildQuestionQueue(["A", "B"], alternatives).map((_, i) => ({ v: i + 1 }));
  const payload = {
    step: 2, goal: "Teste", criteria, alternatives, answers,
    qIndex: 0, queueDims: { nCrit: 2, nAlt: 2 }, phase: "ask",
    correction: null, sliderIdx: 0, sliderTouched: false, structuralAdd: null,
  };
  global.localStorage = { getItem: () => JSON.stringify(payload), setItem: () => {} };
  try {
    assert.equal(AHP.restoreState(), true);
    assert.equal(AHP.__test.state.criteria.length, 3);
    assert.equal(AHP.__test.state.questions.length, 3);
    assert.equal(AHP.__test.state.answers.filter(Boolean).length, 3);
    assert.deepEqual(AHP.__test.state.queueDims, { nCrit: 2, nAlt: 2 });
  } finally {
    delete global.localStorage;
  }
});

test("restoreState descarta respostas quando a linha adicionada foi preenchida", () => {
  const criteria = ["A", "B", "C"];
  const alternatives = ["X", "Y"];
  const answers = AHP.buildQuestionQueue(criteria, alternatives).map((_, i) => ({ v: i + 1 }));
  const payload = {
    step: 2, goal: "Teste", criteria, alternatives, answers,
    qIndex: 0, queueDims: { nCrit: 3, nAlt: 2 }, phase: "ask",
    correction: null, sliderIdx: 0, sliderTouched: false,
    structuralAdd: [{ kind: "crit", start: 2 }],
  };
  global.localStorage = { getItem: () => JSON.stringify(payload), setItem: () => {} };
  try {
    assert.equal(AHP.restoreState(), true);
    assert.equal(AHP.__test.state.criteria.length, 3);
    assert.equal(AHP.__test.state.answers.filter(Boolean).length, 0);
    assert.equal(AHP.__test.state.queueDims, null);
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
