# Método Saaty (AHP) — Projeto Exemplo Interativo

Projeto web interativo (sem build, sem dependências de runtime) que exemplifica o **método Saaty / AHP (Analytic Hierarchy Process)** de apoio à decisão multicritério. Tudo roda no navegador, sem servidor e sem conta.

## Exemplo padrão
**Objetivo:** Escolher o melhor carro
**Critérios:** Custo, Conforto, Economia, Segurança
**Alternativas:** Carro A, Carro B, Carro C

## Como usar (para qualquer pessoa)
O assistente guia a decisão em **5 etapas**:

1. **Decisão** — escreva com suas palavras o que quer decidir (Enter também avança).
2. **Critérios** — liste de 2 a 5 pontos que importam.
3. **Opções** — liste de 2 a 5 alternativas.
4. **Comparar** — responda uma perguntinha por vez, arrastando um slider (“para onde pesa mais?”), com frase-resumo ao vivo e leitura por leitor de tela. Se uma resposta se contradizer com as anteriores, o app avisa **na hora** e mostra o trio intransitivo. Dá para voltar e editar qualquer resposta em “ver todas as respostas”.
5. **Resultado** — vencedor em destaque, gráfico, o porquê (“Segurança foi o que mais pesou: 46%”) e, se houver inconsistência, o ponto exato com botões **“Rever …”** e **“Corrigir todos de uma vez”**. O modo correção leva só às perguntas problemáticas e volta ao resultado recalculado sozinho.

Detalhes matemáticos (matrizes, λ<sub>máx</sub>, CR) ficam escondidos em “🔬 Ver os cálculos”.

O progresso fica salvo no navegador (`localStorage`): recarregar a página retoma exatamente onde você estava. “↺ Nova decisão” limpa o progresso.

## Como executar
Qualquer uma das opções (é só frontend):

```bash
# opção 1 — Python
python3 -m http.server 8000
# abrir http://localhost:8000

# opção 2 — Node
npx serve .
# opção 3 — só abrir o arquivo index.html no navegador
```

### Testes
Sem dependências: usa o runner nativo do Node (18+).

```bash
npm test
```

Os testes cobrem o núcleo AHP (CR, pesos, reciprocidade), a fila de perguntas, detecção de ciclos, a escala do slider, a descrição verbal de valores pares/ímpares de Saaty e a sincronia entre `EXAMPLE` (em `ahp.js`) e `exemplo.json`.

## Estrutura
```
saaty/
├── index.html   # interface (5 etapas)
├── style.css    # visual
├── ahp.js       # núcleo AHP, estado, UI, persistência + exemplo
├── exemplo.json # matrizes do exemplo (referência/aula e teste de sincronia)
├── test/
│   └── ahp.test.js
├── package.json # script npm test
└── README.md
```

## O que o projeto demonstra (passo a passo do Saaty)
1. **Decompor hierarquia:** Objetivo → Critérios → Alternativas.
2. **Comparações pareadas** com a escala fundamental de Saaty (1–9).
3. **Matriz recíproca** `a_ji = 1/a_ij`, `a_ii = 1` — mantida automaticamente a cada resposta.
4. **Vetor de prioridades** (método da normalização das colunas + média das linhas).
5. **Consistência:** `λ_max`, `CI = (λ_max − n)/(n−1)`, `CR = CI/RI`. Se `CR < 0,10` → julgamentos consistentes.
6. **Síntese:** prioridade global = Σ (peso do critério × prioridade local da alternativa).

## Escala de Saaty
| Valor | Significado |
|-------|-------------|
| 1 | Igual importância |
| 3 | Importância moderada |
| 5 | Importância forte |
| 7 | Importância muito forte |
| 9 | Importância extrema |
| 2,4,6,8 | Valores intermediários |
| 1/3,1/5... | Recíprocos (inverso da comparação) |

## Índice Randômico (RI)
| n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|----|
| RI | 0 | 0 | 0,58 | 0,90 | 1,12 | 1,24 | 1,32 | 1,41 | 1,45 | 1,49 |

## Roteiro para apresentação
1. Mostrar a hierarquia (objetivo → critérios → opções) no stepper do topo.
2. Responder algumas comparações e destacar a reciprocidade automática em “🔬 Ver os cálculos”.
3. Mostrar o vetor de prioridades + CR no painel técnico.
4. Repetir para cada critério × alternativas.
5. Mostrar o ranking final + gráfico de barras + interpretação (“o que mais pesou”).
6. Demonstrar inconsistência: responder um trio intransitivo (X > Y, Y > Z, Z > X), mostrar o aviso na hora e usar “Corrigir todos de uma vez”.
7. Recarregar a página para mostrar que o progresso foi preservado.
