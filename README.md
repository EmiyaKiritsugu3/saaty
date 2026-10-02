# Método Saaty (AHP) — Projeto Exemplo Interativo

Projeto web interativo (sem build, sem dependências) que exemplifica o **método Saaty / AHP (Analytic Hierarchy Process)** de apoio à decisão multicritério.

## Exemplo padrão
**Objetivo:** Escolher o melhor carro
**Critérios:** Custo, Conforto, Economia, Segurança
**Alternativas:** Carro A, Carro B, Carro C

## Como usar (para qualquer pessoa)
1. Abra o site e escreva **o que quer decidir**.
2. Liste **o que importa** (critérios) e **as opções**.
3. Responda **uma perguntinha por vez arrastando um slider** (“para onde pesa mais?”) com frase-resumo ao vivo. Se uma resposta se contradiz com as anteriores, o app avisa **na hora** e mostra exatamente onde está a contradição. Barra de progresso mostra onde você está; dá para voltar e editar qualquer resposta em “ver todas as respostas”.
4. Receba o **resultado em português claro**: vencedor em destaque, gráfico, o porquê (“Segurança foi o que mais pesou: 46%”) e um aviso se suas respostas se contradizem, com botão para rever o ponto exato.
5. Detalhes matemáticos (matrizes, λ<sub>máx</sub>, CR) ficam escondidos em “🔬 Ver os cálculos”.

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

## Estrutura
```
saaty/
├── index.html   # interface (4 etapas)
├── style.css    # visual
├── ahp.js       # lógica AHP + matrizes dinâmicas + exemplo
├── exemplo.json # matrizes do exemplo (para referência/aula)
└── README.md
```

## O que o projeto demonstra (passo a passo do Saaty)
1. **Decompor hierarquia:** Objetivo → Critérios → Alternativas.
2. **Comparações pareadas** com a escala fundamental de Saaty (1–9).
3. **Matriz recíproca** `a_ji = 1/a_ij`, `a_ii = 1`.
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
|---|---|---|---|---|---|---|---|---|---|----|
| RI | 0 | 0 | 0,58 | 0,90 | 1,12 | 1,24 | 1,32 | 1,41 | 1,45 | 1,49 |

## Roteiro para apresentação
1. Mostrar hierarquia (topo da página).
2. Preencher matriz de critérios, destacar reciprocidade automática.
3. Mostrar vetor de prioridades + CR.
4. Repetir para cada critério × alternativas.
5. Mostrar ranking final + gráfico de barras + interpretação.
6. Demonstrar inconsistência: altere um valor para forçar `CR > 0,10` e mostre o alerta.
