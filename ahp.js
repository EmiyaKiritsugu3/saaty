// AHP / Método Saaty — lógica didática (normalização das colunas)
const SAATY_OPTIONS = [
  { v: 9, label: "9 — extrema" },
  { v: 8, label: "8" },
  { v: 7, label: "7 — muito forte" },
  { v: 6, label: "6" },
  { v: 5, label: "5 — forte" },
  { v: 4, label: "4" },
  { v: 3, label: "3 — moderada" },
  { v: 2, label: "2" },
  { v: 1, label: "1 — igual" },
  { v: 1/2, label: "1/2" },
  { v: 1/3, label: "1/3" },
  { v: 1/4, label: "1/4" },
  { v: 1/5, label: "1/5" },
  { v: 1/6, label: "1/6" },
  { v: 1/7, label: "1/7" },
  { v: 1/8, label: "1/8" },
  { v: 1/9, label: "1/9" },
];

const RI = { 1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };

const state = {
  goal: "Escolher o melhor carro",
  criteria: ["Custo", "Conforto", "Economia", "Segurança"],
  alternatives: ["Carro A", "Carro B", "Carro C"],
  critMatrix: [],
  altMatrices: {}, // criterio -> matriz
};

// ---------- Núcleo AHP ----------
function calcAHP(matrix) {
  const n = matrix.length;
  if (n === 0) return null;
  if (n === 1) return { weights: [1], lambdaMax: 1, CI: 0, CR: 0, n: 1, colSums: [matrix[0][0]], norm: [[1]] };

  const colSums = Array(n).fill(0);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) colSums[j] += matrix[i][j];

  const norm = matrix.map(row => row.map((v, j) => v / colSums[j]));
  const weights = norm.map(row => row.reduce((a, b) => a + b, 0) / n);

  // lambda_max: média de (A·w)/w
  const Aw = matrix.map(row => row.reduce((s, v, j) => s + v * weights[j], 0));
  const lambdas = Aw.map((v, i) => v / weights[i]);
  const lambdaMax = lambdas.reduce((a, b) => a + b, 0) / n;

  const CI = (lambdaMax - n) / (n - 1);
  const ri = RI[n] ?? 1.49;
  const CR = ri === 0 ? 0 : CI / ri;
  return { weights, lambdaMax, CI, CR, n, colSums, norm, Aw, lambdas };
}

const fmt = (x, d = 4) => Number(x).toFixed(d).replace(".", ",");
const fmtPct = (x) => (x * 100).toFixed(1).replace(".", ",") + "%";

// ---------- UI: edição ----------
const $ = (id) => document.getElementById(id);

function renderEditors() {
  $("goalInput").value = state.goal;
  $("criteriaList").innerHTML = "";
  state.criteria.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "edit-row";
    div.innerHTML = `<input type="text" data-kind="c" data-i="${i}" value="${escapeHtml(c)}" />`;
    $("criteriaList").appendChild(div);
  });
  $("altList").innerHTML = "";
  state.alternatives.forEach((a, i) => {
    const div = document.createElement("div");
    div.className = "edit-row";
    div.innerHTML = `<input type="text" data-kind="a" data-i="${i}" value="${escapeHtml(a)}" />`;
    $("altList").appendChild(div);
  });
  document.querySelectorAll("#criteriaList input, #altList input, #goalInput").forEach(inp => {
    inp.addEventListener("input", syncFromEditors);
  });
  renderHierarchy();
}

function syncFromEditors() {
  state.goal = $("goalInput").value || "Objetivo";
  document.querySelectorAll('#criteriaList input').forEach(inp => {
    state.criteria[+inp.dataset.i] = inp.value || `Critério ${+inp.dataset.i + 1}`;
  });
  document.querySelectorAll('#altList input').forEach(inp => {
    state.alternatives[+inp.dataset.i] = inp.value || `Alt. ${+inp.dataset.i + 1}`;
  });
  $("subtitleGoal").textContent = state.goal;
  renderHierarchy();
  // renomeia chaves de altMatrices preservando ordem
  const newAlt = {};
  state.criteria.forEach(c => { newAlt[c] = state.altMatrices[c] || null; });
  state.altMatrices = newAlt;
}

function renderHierarchy() {
  $("hierarchyPreview").innerHTML =
    `<strong>🎯 ${escapeHtml(state.goal)}</strong><br>` +
    `↳ <strong>Critérios (${state.criteria.length}):</strong> ${state.criteria.map(escapeHtml).join(" · ")}<br>` +
    `↳ <strong>Alternativas (${state.alternatives.length}):</strong> ${state.alternatives.map(escapeHtml).join(" · ")}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ---------- UI: matrizes ----------
function emptyMatrix(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : i < j ? 1 : 1)));
}

function ensureMatrices() {
  const n = state.criteria.length, m = state.alternatives.length;
  if (state.critMatrix.length !== n || (n && state.critMatrix[0].length !== n))
    state.critMatrix = emptyMatrix(n);
  state.criteria.forEach(c => {
    const M = state.altMatrices[c];
    if (!M || M.length !== m) state.altMatrices[c] = emptyMatrix(m);
  });
}

function selectFor(value) {
  const s = document.createElement("select");
  SAATY_OPTIONS.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.v;
    opt.textContent = o.label;
    if (Math.abs(o.v - value) < 1e-9) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
}

function buildMatrixTable(labels, matrix, onChange) {
  const t = document.createElement("table");
  t.className = "matrix";
  const thead = document.createElement("tr");
  thead.appendChild(Object.assign(document.createElement("th"), { textContent: "▼ linha \\ coluna ▶" }));
  labels.forEach(l => {
    const th = document.createElement("th");
    th.textContent = l;
    thead.appendChild(th);
  });
  t.appendChild(thead);
  const selects = [];
  labels.forEach((rowLabel, i) => {
    const tr = document.createElement("tr");
    const corner = document.createElement("td");
    corner.className = "corner";
    corner.textContent = rowLabel;
    tr.appendChild(corner);
    labels.forEach((_, j) => {
      const td = document.createElement("td");
      if (i === j) {
        td.className = "diag";
        td.textContent = "1";
      } else if (i < j) {
        const sel = selectFor(matrix[i][j]);
        sel.dataset.i = i; sel.dataset.j = j;
        sel.addEventListener("change", () => {
          const v = parseFloat(sel.value);
          matrix[i][j] = v;
          matrix[j][i] = 1 / v;
          buildAll(); // reconstrói para espelhar recíproco
          livePreview();
        });
        td.appendChild(sel);
        selects.push(sel);
      } else {
        const v = matrix[i][j];
        td.textContent = v >= 1 ? String(Math.round(v)) : "1/" + Math.round(1 / v);
        td.title = "Recíproco automático";
        td.style.color = "#64748b";
        td.style.padding = "9px";
      }
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  return t;
}

function buildAll() {
  ensureMatrices();
  // matriz critérios
  const wrap = $("criteriaMatrixWrap");
  wrap.innerHTML = "";
  wrap.appendChild(buildMatrixTable(state.criteria, state.critMatrix));
  // matrizes alternativas
  const box = $("altMatrices");
  box.innerHTML = "";
  state.criteria.forEach(c => {
    const h = document.createElement("h3");
    h.textContent = "Critério: " + c;
    const div = document.createElement("div");
    div.className = "alt-matrix";
    div.appendChild(buildMatrixTable(state.alternatives, state.altMatrices[c]));
    const res = document.createElement("div");
    res.className = "result";
    res.id = "res-" + c;
    box.appendChild(h);
    box.appendChild(div);
    box.appendChild(res);
  });
}

function consistencyBadge(CR) {
  return CR < 0.10
    ? `<span class="badge ok">✔ consistente (CR &lt; 10%)</span>`
    : `<span class="badge bad">✖ inconsistente — revise os julgamentos (CR ≥ 10%)</span>`;
}

function livePreview() {
  const r = calcAHP(state.critMatrix);
  if (!r) return;
  $("criteriaResult").innerHTML =
    `<strong>Pesos dos critérios:</strong> ` +
    state.criteria.map((c, i) => `${escapeHtml(c)} = <strong>${fmtPct(r.weights[i])}</strong>`).join(" · ") +
    `<br>λ<sub>máx</sub> = ${fmt(r.lambdaMax)} · CI = ${fmt(r.CI)} · RI(${r.n}) = ${String(RI[r.n]).replace(".", ",")} · <strong>CR = ${fmt(r.CR * 100, 2)}%</strong> ` +
    consistencyBadge(r.CR);
}

// ---------- Cálculo final ----------
function calculateAll() {
  syncFromEditors();
  ensureMatrices();
  const rc = calcAHP(state.critMatrix);
  const perCrit = {};
  state.criteria.forEach(c => { perCrit[c] = calcAHP(state.altMatrices[c]); });

  // síntese
  const m = state.alternatives.length;
  const global = Array(m).fill(0);
  state.criteria.forEach((c, j) => {
    perCrit[c].weights.forEach((w, i) => { global[i] += rc.weights[j] * w; });
  });
  const ranking = state.alternatives.map((a, i) => ({ alt: a, score: global[i] }))
    .sort((x, y) => y.score - x.score);

  // render resultado
  let html = `<div class="calc-box"><strong>Pesos dos critérios</strong><br>` +
    state.criteria.map((c, j) => `${escapeHtml(c)}: <strong>${fmtPct(rc.weights[j])}</strong>`).join(" · ") +
    `<br>λ<sub>máx</sub>=${fmt(rc.lambdaMax)} · CI=${fmt(rc.CI)} · CR=<strong>${fmt(rc.CR * 100, 2)}%</strong> ${consistencyBadge(rc.CR)}</div>`;

  html += `<table class="prio-table"><tr><th>Alternativa</th>` +
    state.criteria.map(c => `<th>${escapeHtml(c)} (${fmtPct(rc.weights[state.criteria.indexOf(c)])})</th>`).join("") +
    `<th>Prioridade GLOBAL</th></tr>`;
  state.alternatives.forEach((a, i) => {
    html += `<tr><td><strong>${escapeHtml(a)}</strong></td>` +
      state.criteria.map(c => `<td>${fmtPct(perCrit[c].weights[i])}</td>`).join("") +
      `<td><strong>${fmtPct(global[i])}</strong></td></tr>`;
  });
  html += `</table>`;

  const allCR = [rc, ...Object.values(perCrit)].every(r => r.CR < 0.10);
  html += `<p><strong>Ranking:</strong> ` + ranking.map((r, k) => `${k + 1}º ${escapeHtml(r.alt)} (${fmtPct(r.score)})`).join(" › ") + "</p>";
  html += allCR
    ? `<p><span class="badge ok">✔ decisão válida — todas as matrizes consistentes</span></p>`
    : `<p><span class="badge bad">✖ atenção — alguma matriz está inconsistente (CR ≥ 10%). Revise as comparações.</span></p>`;
  $("finalResult").innerHTML = html;

  // gráfico
  const max = Math.max(...global, 0.001);
  $("chart").innerHTML = ranking.map((r, k) =>
    `<div class="bar-row"><span>${k + 1}º ${escapeHtml(r.alt)}</span>` +
    `<div class="bar-track"><div class="bar-fill ${k === 0 ? "winner" : ""}" style="width:${(r.score / max * 100).toFixed(1)}%"></div></div>` +
    `<strong>${fmtPct(r.score)}</strong></div>`).join("");

  // passo a passo didático (matriz de critérios)
  $("steps").innerHTML =
    `<div class="calc-box"><strong>Como o cálculo foi feito (matriz de critérios):</strong><br>` +
    `1️⃣ Somam-se as colunas: [${rc.colSums.map(v => fmt(v, 3)).join(" · ")}].<br>` +
    `2️⃣ Normaliza-se cada célula (valor ÷ soma da coluna).<br>` +
    `3️⃣ O peso de cada critério é a <strong>média da linha</strong> normalizada.<br>` +
    `4️⃣ Calcula-se <code>A·w</code>, divide-se por <code>w</code> e tira-se a média → λ<sub>máx</sub> = ${fmt(rc.lambdaMax)}.<br>` +
    `5️⃣ CI = (λ<sub>máx</sub> − n)/(n−1) = ${fmt(rc.CI)} · CR = CI/RI = ${fmt(rc.CR * 100, 2)}%.<br>` +
    `6️⃣ Repete-se para cada critério × alternativas e sintetiza-se: global = Σ peso<sub>crit</sub> × peso<sub>local</sub>.</div>`;

  // previews por critério
  state.criteria.forEach(c => {
    const r = perCrit[c];
    const el = document.getElementById("res-" + c);
    if (el) el.innerHTML =
      state.alternatives.map((a, i) => `${escapeHtml(a)} = <strong>${fmtPct(r.weights[i])}</strong>`).join(" · ") +
      `<br>λ<sub>máx</sub>=${fmt(r.lambdaMax)} · CI=${fmt(r.CI)} · CR=<strong>${fmt(r.CR * 100, 2)}%</strong> ` + consistencyBadge(r.CR);
  });
  livePreview();
}

// ---------- Exemplo ----------
function loadExample() {
  state.goal = "Escolher o melhor carro";
  state.criteria = ["Custo", "Conforto", "Economia", "Segurança"];
  state.alternatives = ["Carro A", "Carro B", "Carro C"];
  state.critMatrix = [
    [1, 1/3, 1/2, 1/4],
    [3, 1, 2, 1/2],
    [2, 1/2, 1, 1/3],
    [4, 2, 3, 1],
  ];
  state.altMatrices = {
    "Custo":     [[1, 2, 4], [1/2, 1, 2], [1/4, 1/2, 1]],
    "Conforto":  [[1, 1/3, 1/2], [3, 1, 2], [2, 1/2, 1]],
    "Economia":  [[1, 1, 1/2], [1, 1, 1/3], [2, 3, 1]],
    "Segurança": [[1, 1/2, 1/4], [2, 1, 1/2], [4, 2, 1]],
  };
  renderEditors();
  buildAll();
  livePreview();
}

// ---------- Eventos ----------
$("addCriterion").onclick = () => {
  if (state.criteria.length >= 10) return alert("Máximo de 10 critérios (limite do RI).");
  syncFromEditors();
  state.criteria.push("Critério " + (state.criteria.length + 1));
  renderEditors(); buildAll(); livePreview();
};
$("removeCriterion").onclick = () => {
  if (state.criteria.length <= 2) return alert("Mínimo de 2 critérios.");
  syncFromEditors();
  state.criteria.pop();
  renderEditors(); buildAll(); livePreview();
};
$("addAlt").onclick = () => {
  if (state.alternatives.length >= 10) return alert("Máximo de 10 alternativas.");
  syncFromEditors();
  state.alternatives.push("Alternativa " + (state.alternatives.length + 1));
  renderEditors(); buildAll(); livePreview();
};
$("removeAlt").onclick = () => {
  if (state.alternatives.length <= 2) return alert("Mínimo de 2 alternativas.");
  syncFromEditors();
  state.alternatives.pop();
  renderEditors(); buildAll(); livePreview();
};
$("rebuildBtn").onclick = () => { syncFromEditors(); renderEditors(); buildAll(); livePreview(); };
$("loadExample").onclick = loadExample;
$("calcBtn").onclick = calculateAll;

// init
loadExample();
