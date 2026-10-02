// Assistente de decisão — método Saaty/AHP em linguagem simples.
// Núcleo matemático (calcAHP) preservado; a UI guia por perguntas,
// uma de cada vez, sem expor matrizes ou jargão.

// ---------- Núcleo AHP (não mexer) ----------
function calcAHP(matrix) {
  const n = matrix.length;
  if (n === 0) return null;
  if (n === 1) return { weights: [1], lambdaMax: 1, CI: 0, CR: 0, n: 1, colSums: [matrix[0][0]], norm: [[1]] };

  const colSums = Array(n).fill(0);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) colSums[j] += matrix[i][j];

  const norm = matrix.map(row => row.map((v, j) => v / colSums[j]));
  const weights = norm.map(row => row.reduce((a, b) => a + b, 0) / n);

  const Aw = matrix.map(row => row.reduce((s, v, j) => s + v * weights[j], 0));
  const lambdas = Aw.map((v, i) => v / weights[i]);
  const lambdaMax = lambdas.reduce((a, b) => a + b, 0) / n;

  const CI = (lambdaMax - n) / (n - 1);
  const ri = RI[n] ?? 1.49;
  const CR = ri === 0 ? 0 : CI / ri;
  return { weights, lambdaMax, CI, CR, n, colSums, norm, Aw, lambdas };
}

const RI = { 1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };

// ---------- Lógica pura (testável, sem DOM) ----------
const LEVELS = [
  { v: 3, t: "Um pouco mais", d: "pesa um pouco mais na decisão" },
  { v: 5, t: "Bem mais", d: "pesa bem mais na decisão" },
  { v: 7, t: "Muito mais", d: "pesa muito mais na decisão" },
  { v: 9, t: "Extremamente mais", d: "é disparado o mais importante" },
];

// side: 'A' | 'B' | 'equal' → valor de M[i][j] na escala Saaty
function answerToValue(side, intensity) {
  if (side === "equal") return 1;
  return side === "A" ? intensity : 1 / intensity;
}

function questionCount(nCrit, nAlt) {
  return (nCrit * (nCrit - 1)) / 2 + nCrit * ((nAlt * (nAlt - 1)) / 2);
}

// Fila de perguntas: pares de critérios, depois pares de opções por critério.
function buildQuestionQueue(criteria, alternatives) {
  const qs = [];
  for (let i = 0; i < criteria.length; i++)
    for (let j = i + 1; j < criteria.length; j++)
      qs.push({ type: "criteria", i, j, a: criteria[i], b: criteria[j] });
  criteria.forEach((c, cj) => {
    for (let i = 0; i < alternatives.length; i++)
      for (let j = i + 1; j < alternatives.length; j++)
        qs.push({ type: "alt", crit: c, cj, i, j, a: alternatives[i], b: alternatives[j] });
  });
  return qs;
}

function emptyMatrix(n) {
  return Array.from({ length: n }, () => Array(n).fill(1));
}

const fmtPct = (x) => (x * 100).toFixed(1).replace(".", ",") + "%";

// ---------- Estado ----------
const state = {
  step: 1,
  goal: "",
  criteria: ["Custo", "Conforto", "Economia"],
  alternatives: ["Opção A", "Opção B", "Opção C"],
  critMatrix: [],
  altMatrices: {},
  questions: [],
  qIndex: 0,
  phase: "side", // 'side' | 'intensity' | 'overview'
  pickedSide: null,
  answers: [], // por pergunta: {side, intensity} | null
  result: null,
};

function ensureMatrices() {
  const n = state.criteria.length, m = state.alternatives.length;
  state.critMatrix = emptyMatrix(n);
  state.altMatrices = {};
  state.criteria.forEach(c => { state.altMatrices[c] = emptyMatrix(m); });
}

function applyAnswer(q, ans) {
  const v = answerToValue(ans.side, ans.intensity);
  const M = q.type === "criteria" ? state.critMatrix : state.altMatrices[q.crit];
  M[q.i][q.j] = v;
  M[q.j][q.i] = 1 / v;
}

function describeAnswer(q, ans) {
  if (!ans) return "ainda não respondida";
  if (ans.side === "equal") return `${q.a} e ${q.b} empatados`;
  const winner = ans.side === "A" ? q.a : q.b;
  const loser = ans.side === "A" ? q.b : q.a;
  const lvl = LEVELS.find(l => l.v === ans.intensity);
  return `${winner} ${lvl ? lvl.t.toLowerCase() + " importante" : ""} que ${loser}`;
}

// ---------- UI (navegador) ----------
const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function setStepper() {
  document.querySelectorAll("#stepper li").forEach(li => {
    const s = +li.dataset.step;
    li.classList.toggle("done", s < state.step);
    li.classList.toggle("now", s === state.step);
  });
}

function render() {
  setStepper();
  const sc = $("screen");
  if (state.step === 1) return renderGoal(sc);
  if (state.step === 2) return renderList(sc, "crit");
  if (state.step === 3) return renderList(sc, "alt");
  if (state.step === 4) return renderCompare(sc);
  return renderResult(sc);
}

// Passo 1
function renderGoal(sc) {
  sc.innerHTML = `
    <h2>O que você quer decidir?</h2>
    <p class="lead">Escreva com suas palavras. Exemplos: "qual carro comprar", "onde morar", "qual fornecedor contratar".</p>
    <label class="field" for="goal">Minha decisão é…</label>
    <input id="goal" class="big-input" placeholder="Ex.: Escolher o melhor carro" value="${escapeHtml(state.goal)}" />
    <div class="row space">
      <button class="linklike" id="exBtn">👀 ver exemplo pronto</button>
      <button class="primary" id="next1">Continuar →</button>
    </div>`;
  $("next1").onclick = () => {
    const g = $("goal").value.trim();
    if (!g) { $("goal").focus(); $("goal").style.borderColor = "#dc2626"; return; }
    state.goal = g;
    state.step = 2;
    render();
  };
  $("exBtn").onclick = () => { loadExample(); };
}

// Passo 2/3 (genérico)
function renderList(sc, kind) {
  const isCrit = kind === "crit";
  const items = isCrit ? state.criteria : state.alternatives;
  const max = 5;
  sc.innerHTML = `
    <h2>${isCrit ? "O que importa nessa decisão?" : "Quais são as opções?"}</h2>
    <p class="lead">${isCrit
      ? "Liste de 2 a 5 pontos importantes. Ex.: preço, conforto, segurança."
      : "Liste de 2 a 5 alternativas. Ex.: Carro A, Carro B, Carro C."}</p>
    <div id="items"></div>
    <div class="row">
      <button id="add">+ Adicionar</button>
      <button id="rm" class="ghost">− Remover último</button>
    </div>
    <div class="count-note" id="countNote"></div>
    <div class="row space">
      <button class="ghost" id="back">← Voltar</button>
      <button class="primary" id="next">Continuar →</button>
    </div>`;

  const box = $("items");
  const draw = () => {
    box.innerHTML = "";
    items.forEach((val, i) => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `<input data-i="${i}" value="${escapeHtml(val)}" placeholder="${isCrit ? "Ex.: preço" : "Ex.: Opção " + (i + 1)}" />
        ${items.length > 2 ? `<button data-del="${i}" title="Excluir">✕</button>` : ""}`;
      box.appendChild(row);
    });
    box.querySelectorAll("input").forEach(inp => {
      inp.oninput = () => { items[+inp.dataset.i] = inp.value; updateCount(); };
    });
    box.querySelectorAll("[data-del]").forEach(b => {
      b.onclick = () => { syncItems(); items.splice(+b.dataset.del, 1); render(); };
    });
    updateCount();
  };
  const syncItems = () => {
    box.querySelectorAll("input").forEach(inp => { items[+inp.dataset.i] = inp.value; });
  };
  const updateCount = () => {
    syncItems();
    const filled = items.map(s => s.trim()).filter(Boolean);
    const nC = isCrit ? filled.length : state.criteria.filter(s => s.trim()).length;
    const nA = isCrit ? state.alternatives.filter(s => s.trim()).length : filled.length;
    const n = (isCrit || state.step === 3) ? questionCount(Math.max(nC, 2), Math.max(nA, 2)) : 0;
    $("countNote").innerHTML = filled.length < 2
      ? `⚠ Preencha pelo menos <strong>2 itens</strong>.`
      : `✔ Com ${nC} critério(s) e ${nA} opção(ões), faremos <strong>${n} perguntinhas</strong> rápidas. Quanto menos itens, mais rápido.`;
  };
  draw();
  $("add").onclick = () => {
    if (items.length >= max) return alert(`Máximo de ${max} itens — mais que isso vira uma eternidade de perguntas.`);
    syncItems(); items.push(""); render();
  };
  $("rm").onclick = () => {
    if (items.length <= 2) return alert("Mínimo de 2 itens.");
    syncItems(); items.pop(); render();
  };
  $("back").onclick = () => { syncItems(); state.step -= 1; render(); };
  $("next").onclick = () => {
    syncItems();
    const filled = items.map(s => s.trim()).filter(Boolean);
    if (filled.length < 2) return alert("Preencha pelo menos 2 itens.");
    if (isCrit) state.criteria = filled; else state.alternatives = filled;
    ensureMatrices();
    state.step += 1;
    if (state.step === 4) startQuestions();
    render();
  };
}

// Passo 4
function startQuestions() {
  state.questions = buildQuestionQueue(state.criteria, state.alternatives);
  state.answers = state.questions.map(() => null);
  state.qIndex = 0;
  state.phase = "side";
  state.pickedSide = null;
}

function renderCompare(sc) {
  if (state.phase === "overview") return renderOverview(sc);
  const q = state.questions[state.qIndex];
  const total = state.questions.length;
  const groupTag = q.type === "criteria"
    ? `⚖️ Comparando critérios · pergunta ${state.qIndex + 1} de ${total}`
    : `🔎 Opções em “${escapeHtml(q.crit)}” · pergunta ${state.qIndex + 1} de ${total}`;
  const question = q.type === "criteria"
    ? `Para <strong>${escapeHtml(state.goal.toLowerCase())}</strong>, o que pesa mais?`
    : `Pensando <strong>só em ${escapeHtml(q.crit.toLowerCase())}</strong>, qual opção é melhor?`;

  let body = `<span class="qtag">${groupTag}</span>
    <div class="qbar"><div style="width:${(state.qIndex / total * 100).toFixed(0)}%"></div></div>
    <p class="qtext">${question}</p>`;

  if (state.phase === "side") {
    body += `<div class="vs">
        <button id="pickA">${escapeHtml(q.a)}</button>
        <button id="pickB">${escapeHtml(q.b)}</button>
      </div>
      <div class="row" style="justify-content:center"><button class="ghost" id="pickEq">🤝 São equivalentes</button></div>`;
  } else {
    const winner = state.pickedSide === "A" ? q.a : q.b;
    const loser = state.pickedSide === "A" ? q.b : q.a;
    body += `<p class="hint"><strong>${escapeHtml(winner)}</strong> ganhou. Quanto mais?</p>
      <div class="levels">` + LEVELS.map(l =>
        `<button data-v="${l.v}"><strong>${l.t} mais importante</strong><small>${escapeHtml(winner)} ${l.d}</small></button>`
      ).join("") + `</div>
      <div class="row"><button class="ghost" id="backSide">← Trocar escolha</button></div>`;
  }

  body += `<div class="row space">
      <button class="linklike" id="qback">← Voltar</button>
      <button class="linklike" id="qall">Ver todas as respostas</button>
    </div>`;
  sc.innerHTML = body;

  if (state.phase === "side") {
    $("pickA").onclick = () => { state.pickedSide = "A"; state.phase = "intensity"; render(); };
    $("pickB").onclick = () => { state.pickedSide = "B"; state.phase = "intensity"; render(); };
    $("pickEq").onclick = () => saveAnswer({ side: "equal", intensity: 1 });
  } else {
    sc.querySelectorAll("[data-v]").forEach(b => {
      b.onclick = () => saveAnswer({ side: state.pickedSide, intensity: +b.dataset.v });
    });
    $("backSide").onclick = () => { state.phase = "side"; render(); };
  }
  $("qback").onclick = () => {
    if (state.phase === "intensity") { state.phase = "side"; render(); return; }
    if (state.qIndex === 0) { state.step = 3; render(); return; }
    state.qIndex -= 1; state.phase = "side"; state.pickedSide = null; render();
  };
  $("qall").onclick = () => { state.phase = "overview"; render(); };
}

function saveAnswer(ans) {
  const q = state.questions[state.qIndex];
  state.answers[state.qIndex] = ans;
  applyAnswer(q, ans);
  state.pickedSide = null;
  if (state.qIndex + 1 >= state.questions.length) {
    finishAndShowResult();
    return;
  }
  state.qIndex += 1;
  state.phase = "side";
  render();
}

function renderOverview(sc) {
  const items = state.questions.map((q, i) => {
    const tag = q.type === "criteria" ? "Critérios" : escapeHtml(q.crit);
    return `<li><span><strong>${tag}:</strong> ${escapeHtml(q.a)} × ${escapeHtml(q.b)} — <em>${escapeHtml(describeAnswer(q, state.answers[i]))}</em></span>
      <button data-j="${i}">Editar</button></li>`;
  }).join("");
  const done = state.answers.filter(Boolean).length;
  sc.innerHTML = `<h2>Suas respostas (${done} de ${state.questions.length})</h2>
    <p class="lead">Toque em <strong>Editar</strong> para mudar qualquer resposta.</p>
    <ul class="ans-list">${items}</ul>
    <div class="row space">
      <button class="ghost" id="ovBack">← Voltar às perguntas</button>
      ${done === state.questions.length ? `<button class="primary" id="ovGo">Ver resultado →</button>` : ""}
    </div>`;
  sc.querySelectorAll("[data-j]").forEach(b => {
    b.onclick = () => { state.qIndex = +b.dataset.j; state.phase = "side"; state.pickedSide = null; render(); };
  });
  $("ovBack").onclick = () => { state.phase = "side"; render(); };
  const go = $("ovGo");
  if (go) go.onclick = () => finishAndShowResult();
}

// Passo 5
function finishAndShowResult() {
  const rc = calcAHP(state.critMatrix);
  const perCrit = {};
  state.criteria.forEach(c => { perCrit[c] = calcAHP(state.altMatrices[c]); });
  const global = state.alternatives.map((_, i) =>
    state.criteria.reduce((s, c, j) => s + rc.weights[j] * perCrit[c].weights[i], 0));
  const ranking = state.alternatives.map((a, i) => ({ alt: a, score: global[i] }))
    .sort((x, y) => y.score - x.score);
  state.result = { rc, perCrit, global, ranking };
  state.step = 5;
  render();
}

function groupQuestionIndex(type, cj) {
  return state.questions.findIndex(q =>
    type === "criteria" ? q.type === "criteria" : (q.type === "alt" && q.cj === cj));
}

function renderResult(sc) {
  const { rc, perCrit, global, ranking } = state.result;
  const win = ranking[0];
  const topC = state.criteria.map((c, j) => ({ c, w: rc.weights[j] })).sort((a, b) => b.w - a.w)[0];
  const max = Math.max(...global, 0.001);

  const groups = [
    { name: "critérios em geral", r: rc, type: "criteria", cj: -1 },
    ...state.criteria.map((c, cj) => ({ name: `opções em “${c}”`, r: perCrit[c], type: "alt", cj })),
  ];
  const bad = groups.filter(g => g.r.CR >= 0.10);

  let coherence;
  if (bad.length === 0) {
    coherence = `<div class="coherence ok">✔ <strong>Suas respostas foram coerentes.</strong> Nada se contradiz — pode confiar no resultado.</div>`;
  } else {
    coherence = `<div class="coherence bad">⚠ <strong>Há uma contradição nas suas respostas</strong> ${bad.map(g =>
      `sobre <strong>${escapeHtml(g.name)}</strong>`).join(" e ")}.
      Isso acontece quando dizemos, por exemplo, que A ganha de B, B ganha de C, mas C ganha de A.
      <div class="row">${bad.map((g, k) => `<button data-rev="${g.type}:${g.cj}">Rever ${escapeHtml(g.name)}</button>`).join("")}</div></div>`;
  }

  sc.innerHTML = `
    <h2>Resultado para: ${escapeHtml(state.goal)}</h2>
    <div class="winner"><div class="trophy">🏆</div>
      <div>A melhor escolha para você é</div><h3>${escapeHtml(win.alt)}</h3>
      <div class="hint">${fmtPct(win.score)} da pontuação total</div></div>
    <div id="bars">` + ranking.map((r, k) =>
      `<div class="bar-row"><span>${k + 1}º ${escapeHtml(r.alt)}</span>
       <div class="bar-track"><div class="bar-fill ${k === 0 ? "winner-fill" : ""}" style="width:${(r.score / max * 100).toFixed(1)}%"></div></div>
       <strong>${fmtPct(r.score)}</strong></div>`).join("") + `</div>
    <p>💡 <strong>Por quê?</strong> O que mais contou na sua decisão foi <strong>${escapeHtml(topC.c)} (${fmtPct(topC.w)} do peso)</strong>.</p>
    ${coherence}
    <div class="row space">
      <button class="ghost" id="adjust">✏️ Ajustar respostas</button>
      <button class="ghost" id="restart">↺ Nova decisão</button>
    </div>
    <details class="tech"><summary>🔬 Ver os cálculos (para curiosos e professores)</summary>
      <div id="techBody"></div></details>`;

  sc.querySelectorAll("[data-rev]").forEach(b => {
    b.onclick = () => {
      const [type, cj] = b.dataset.rev.split(":");
      state.qIndex = Math.max(0, groupQuestionIndex(type, +cj));
      state.phase = "side"; state.pickedSide = null; state.step = 4; render();
    };
  });
  $("adjust").onclick = () => { state.step = 4; state.phase = "overview"; render(); };
  $("restart").onclick = () => {
    state.step = 1; state.goal = "";
    state.criteria = ["", ""]; state.alternatives = ["", ""];
    state.result = null; render();
  };

  // Detalhe técnico (opcional)
  const tb = $("techBody");
  const mTable = (labels, M) => `<table class="matrix"><tr><th></th>${labels.map(l => `<th>${escapeHtml(l)}</th>`).join("")}</tr>` +
    M.map((row, i) => `<tr><th>${escapeHtml(labels[i])}</th>${row.map(v =>
      `<td>${v >= 1 ? v : "1/" + Math.round(1 / v)}</td>`).join("")}</tr>`).join("") + `</table>`;
  tb.innerHTML =
    `<p><strong>Pesos dos critérios:</strong> ${state.criteria.map((c, j) => `${escapeHtml(c)} = ${fmtPct(rc.weights[j])}`).join(" · ")}</p>` +
    `<p>λ<sub>máx</sub>=${rc.lambdaMax.toFixed(4).replace(".", ",")} · CI=${rc.CI.toFixed(4).replace(".", ",")} · CR=<strong>${(rc.CR * 100).toFixed(2).replace(".", ",")}%</strong> (ok se &lt; 10%)</p>` +
    mTable(state.criteria, state.critMatrix) +
    state.criteria.map(c => `<p><strong>${escapeHtml(c)}:</strong> ` +
      state.alternatives.map((a, i) => `${escapeHtml(a)} = ${fmtPct(perCrit[c].weights[i])}`).join(" · ") +
      ` (CR=${(perCrit[c].CR * 100).toFixed(2).replace(".", ",")}%)</p>` + mTable(state.alternatives, state.altMatrices[c])).join("");
}

// Exemplo pronto
function loadExample() {
  state.goal = "Escolher o melhor carro";
  state.criteria = ["Custo", "Conforto", "Economia", "Segurança"];
  state.alternatives = ["Carro A", "Carro B", "Carro C"];
  ensureMatrices();
  state.critMatrix = [[1, 1/3, 1/2, 1/4], [3, 1, 2, 1/2], [2, 1/2, 1, 1/3], [4, 2, 3, 1]];
  state.altMatrices = {
    "Custo": [[1, 2, 4], [1/2, 1, 2], [1/4, 1/2, 1]],
    "Conforto": [[1, 1/3, 1/2], [3, 1, 2], [2, 1/2, 1]],
    "Economia": [[1, 1, 1/2], [1, 1, 1/3], [2, 3, 1]],
    "Segurança": [[1, 1/2, 1/4], [2, 1, 1/2], [4, 2, 1]],
  };
  finishAndShowResult();
}

if (typeof document !== "undefined") render();
