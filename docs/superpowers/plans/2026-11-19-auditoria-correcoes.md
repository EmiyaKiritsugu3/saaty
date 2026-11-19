# Auditoria Saaty — Correções e Otimizações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar os achados da auditoria de 2026-11-19 (1 crítico, 5 médios, higiene), adicionar testes automatizados, acessibilidade e persistência, entregando um PR verificável.

**Architecture:** App estático permanece sem build e sem dependências de runtime. O núcleo AHP continua em `ahp.js`, ganha guarda de exportação CommonJS para testes `node:test`; a camada DOM permanece no mesmo arquivo, com persistência e acessibilidade isoladas em funções pequenas (`persistState`, `restoreState`, `setSliderValueText`). Os dados do exemplo viram uma constante única `EXAMPLE`, usada tanto pela UI quanto pelo teste de sincronia com `exemplo.json`.

**Tech Stack:** JavaScript ES2020 (vanilla, CommonJS guard), `node:test` + `node:assert/strict` (Node 26), HTML/CSS estáticos, Playwright MCP para verificação end-to-end, GitHub CLI (`gh`) para a PR.

**Spec:** Relatório da auditoria (mensagem anterior) + `README.md` + `exemplo.json`.

## Global Constraints

- Nenhuma dependência de runtime; a app continua abrindo com `file://` e `python3 -m http.server`.
- Toda interpolação de dado do usuário em HTML continua passando por `escapeHtml()`.
- Núcleo AHP (`calcAHP`, `RI`, escala do slider) não muda de comportamento numérico.
- Mensagens de UI permanecem em pt-BR e no tom simples para leigos.
- Cada tarefa termina com teste executável e commit próprio.

## Review Focus

| Input / condição | Comportamento esperado | Teste na tarefa |
|---|---|---|
| Clique em "Corrigir os N pontos de uma vez" com N ≥ 1 | Entra no modo correção, sem `ReferenceError` | Smoke test Playwright (Task 1) |
| `exemplo.json` e constantes do exemplo divergirem | Teste falha | `test/ahp.test.js` (Task 2) |
| Valor Saaty par (2, 4, 6, 8) em `describeAnswer` | Nunca produz "undefined" | `test/ahp.test.js` (Task 3) |
| Recarregar página após responder perguntas | Progresso restaurado, sem perder respostas | Smoke test Playwright (Task 5) |
| `localStorage` indisponível / corrompido | App inicia com estado limpo, sem crash | Smoke test Playwright (Task 5) |

---

### Task 1: Corrigir bug crítico do botão "Corrigir todos"

**Files:**
- Modify: `ahp.js:571-605` (`renderResult`)

**Interfaces:**
- Consumes: `startCorrection(indices)` já existente (`ahp.js:337`).
- Produces: nenhuma interface nova; `fixAll.onclick` passa a enxergar `details`.

- [ ] **Step 1: Declarar `let details = [];` imediatamente antes de `let coherence;` em `renderResult` (~linha 571). Trocar `const details = bad.map(groupDetail);` dentro do `else` por `details = bad.map(groupDetail);` e manter `fixAll.onclick = () => startCorrection(details.map(d => d.jump));` — isso elimina o `ReferenceError` de escopo de bloco.**
- [ ] **Step 2: Servir a app (`python3 -m http.server 8765`) e validar no Playwright: gerar contradição nos critérios, clicar em "🔧 Corrigir os 1 pontos de uma vez", confirmar que aparece "🔧 Ajuste 1 de 1" e que `browser_console_messages(level="error")` está vazio.**
- [ ] **Step 3: Commit**

```bash
git add ahp.js
git commit -m "fix(correction): corrige ReferenceError no botao corrigir todos"
```

---

### Task 2: Harness de testes + constante `EXAMPLE` sincronizada

**Files:**
- Create: `package.json`, `test/ahp.test.js`
- Modify: `ahp.js:634-656` (`loadExample`), fim do arquivo (guarda de exportação)

**Interfaces:**
- Consumes: funções puras de `ahp.js`.
- Produces: `module.exports = { calcAHP, RI, sliderIndexToValue, valueToSliderIndex, describeAnswer, questionCount, buildQuestionQueue, findCycle, findWorstOffender, EXAMPLE }`.

- [ ] **Step 1: Criar `package.json` com `{"name":"saaty-ahp","private":true,"scripts":{"test":"node --test test/*.test.js"}}`. Sem `dependencies`.**
- [ ] **Step 2: Criar `const EXAMPLE = {...}` em `ahp.js` com `goal`, `criteria`, `alternatives`, `critMatrix`, `altMatrices` (valores atuais de `loadExample`) e fazer `loadExample()` copiar dali. Adicionar guarda `if (typeof module !== "undefined" && module.exports) module.exports = {...}` no fim do arquivo, após o bootstrap do navegador.**
- [ ] **Step 3: Escrever testes `node:test`: `calcAHP` do exemplo (CR < 0.10 e |soma pesos − 1| < 1e-9), reciprocidade, `questionCount(4,3) === 18`, tamanho de `buildQuestionQueue`, `findCycle` em matriz intransitiva, `sliderIndexToValue` no mapa completo (−4→9 … 4→1/9) e `EXAMPLE` igual a `exemplo.json` (comparação numérica com tolerância 1e-9).**
- [ ] **Step 4: Rodar `npm test`; esperado PASS com 7 testes.**
- [ ] **Step 5: Commit**

```bash
git add package.json test/ahp.test.js ahp.js
git commit -m "test: adiciona node:test e sincroniza exemplo com exemplo.json"
```

---

### Task 3: Corrigir `describeAnswer` para valores Saaty pares

**Files:**
- Modify: `ahp.js:152-160`, `test/ahp.test.js`

**Interfaces:**
- Consumes: `sliderIndexToValue`, `valueToSliderIndex`, `MAG_WORD` (todos em `ahp.js`); harness da Task 2.
- Produces: `describeAnswer({a,b},{v}) -> string` sem "undefined".

- [ ] **Step 1: Adicionar em `test/ahp.test.js` casos para `describeAnswer({a:"X",b:"Y"},{v})` com `v ∈ {2,4,1/2,1/4}` (nenhum resultado contém "undefined") e `v ∈ {3,9,1/3,1/9}` (mantêm `MAG_WORD`).**
- [ ] **Step 2: Rodar `npm test`; esperado FAIL nos casos pares.**
- [ ] **Step 3: Implementar `describeAnswer`: `idx = valueToSliderIndex(ans.v)`; se `idx === 0`, empate; caso contrário `mag = Math.abs(sliderIndexToValue(idx))`, `winner = idx < 0 ? q.a : q.b`, `loser` invertido, e usar `MAG_WORD[mag]`.**
- [ ] **Step 4: Rodar `npm test`; esperado PASS.**
- [ ] **Step 5: Commit**

```bash
git add ahp.js test/ahp.test.js
git commit -m "fix(ahp): descreve valores Saaty pares sem texto undefined"
```

---

### Task 4: Acessibilidade e micro-higiene

**Files:**
- Modify: `ahp.js` (`state`, `render`, `renderCompare`, `advance`, `restart`), `index.html:27`, `style.css`

**Interfaces:**
- Consumes: `render()` central.
- Produces: `setSliderValueText(idx, a, b)` usada no `oninput` do slider.

- [ ] **Step 1: Declarar `sliderTouched: false` em `state`; resetar `correction: null` em `restart`; remover atribuições mortas de `sliderIdx = 0` em `advance` (~linhas 447 e 457).**
- [ ] **Step 2: Em `renderCompare`, dar `aria-label="Comparação entre A e B"` e `aria-valuetext` ao `#sat`, atualizando ambos no `oninput` via `setSliderValueText`; marcar `#satLive` com `aria-live="polite"`. Em `renderGoal`, adicionar `onkeydown` no `#goal` para Enter disparar `#next1`.**
- [ ] **Step 3: Em `render()`, antes do dispatch, chamar `$("screen").focus({ preventScroll: true })`; adicionar `tabindex="-1"` ao `#screen` em `index.html`. Adicionar `:focus-visible` em `style.css` e remover seletores mortos (`.row.end`, `table.prio`, `button:disabled`, `--warn`).**
- [ ] **Step 4: Validar no Playwright: slider expõe `aria-valuetext` atualizado; Enter no `#goal` avança de etapa; nenhum erro de console.**
- [ ] **Step 5: Commit**

```bash
git add ahp.js index.html style.css
git commit -m "a11y: rotula slider, foco pos-render e Enter no campo de decisao"
```

---

### Task 5: Persistência local (progresso sobrevive ao reload)

**Files:**
- Modify: `ahp.js` (novas `persistState`/`restoreState`/`computeResult`, `render`, `finishAndShowResult`, `restart`)

**Interfaces:**
- Consumes: `buildQuestionQueue`, `calcAHP`, `ensureMatrices`.
- Produces: `STORAGE_KEY = "saaty.estado.v1"`; `computeResult()` sem render.

- [ ] **Step 1: Extrair o cálculo de `finishAndShowResult()` para `computeResult()` (preenche `state.result`); `finishAndShowResult()` passa a chamar `computeResult(); state.step = 5; render();`.**
- [ ] **Step 2: Implementar `persistState()` — serializa `{step, goal, criteria, alternatives, critMatrix, altMatrices, answers, qIndex, queueDims, phase}` em `localStorage` com `try/catch` silencioso; chamar no início de `render()`. Implementar `restoreState()` — valida `criteria`/`alternatives` arrays com 2..5 itens, dimensões das matrizes e `answers.length === questions.length`; reconstrói `questions` via `buildQuestionQueue`; se `step === 5`, chama `computeResult()`; retorna `false` em qualquer falha.**
- [ ] **Step 3: No bootstrap (`typeof document !== "undefined"`), chamar `restoreState()` antes de `render()`. Em `restart`, remover a chave do `localStorage`.**
- [ ] **Step 4: Validar no Playwright: responder 2 perguntas, recarregar, confirmar que o app retoma na pergunta 3 com respostas preservadas; depois corromper a chave via `localStorage.setItem` e recarregar, confirmando inicialização limpa sem erro.**
- [ ] **Step 5: Commit**

```bash
git add ahp.js
git commit -m "feat: persiste progresso da decisao em localStorage"
```

---

### Task 6: Documentação e fechamento

**Files:**
- Modify: `README.md`, `docs/superpowers/plans/2026-11-19-auditoria-correcoes.md`

**Interfaces:**
- Consumes: estado final do código.
- Produces: README coerente com 5 etapas e com os testes.

- [ ] **Step 1: Atualizar `README.md`: "5 etapas", descrever modo correção, persistência e acessibilidade; corrigir roteiro que ainda fala em preencher matrizes diretamente; documentar `npm test`.**
- [ ] **Step 2: Rodar `npm test`, `git diff --check` e smoke test final no Playwright (exemplo + contradição + correção + reload).**
- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/plans/2026-11-19-auditoria-correcoes.md
git commit -m "docs: atualiza README e registra plano de auditoria"
```

---

### Task 7: Publicar PR

**Files:** nenhum.

- [ ] **Step 1: `git push -u origin fix/auditoria-correcoes`.**
- [ ] **Step 2: `gh pr create --base main --head fix/auditoria-correcoes --title ... --body ...` descrevendo achados corrigidos, testes e verificação via Playwright.**
- [ ] **Step 3: Confirmar URL da PR e reportar.**
