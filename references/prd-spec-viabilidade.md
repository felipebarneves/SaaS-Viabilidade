> PRD padrão para construção de SaaS B2B. À medida que as telas ou APIs de cálculo forem gerados, usar o Bloco 7 (Definition of Done) como checkjlist para aprovar os Pull Requests ou Commits gerados pela IA.
> 
> Prompt Padrão para iniciar o projeto:
> *"Abra o arquivo `prd-spec-viabilidade.md`. Ele contém a arquitetura padrão e as especificações de negócio que você deve seguir estritamente. Implemente a estrutura de banco de dados e a engine de simulação focando nos inputs e regras de cálculo descritos na seção 2 do documento."*
# SYSTEM SPECIFICATION & PRD: [SAAS DE VIABILIDADE FINANCEIRA]

## 1. DIRETRIZES DO PROJETO & REGRAS DE ENGAJAMENTO (IA)
*Este documento é a "Single Source of Truth" (SSOT) para desenvolvimento do SaaS. Deve ser utilizado como contexto principal em todas as sessões de codificação e geração de código.*

### 1.1. Diretrizes para a IA
1. **Padrão de Código:** Código limpo, tipado (TypeScript no Frontend/Backend ou Python com Type Hints). Sem dependências duplicadas.
2. **Engine de Cálculo Centralizada:** Todas as regras, fórmulas matemáticas e simulações devem ser implementadas em um módulo isolado e tipado (`/core/engine` ou similar). **Nunca** replique lógica matemática diretamente em componentes de tela.
3. **Abordagem Incremental e Segura:** Implemente uma funcionalidade ou fluxo de dados por vez. Execute testes unitários locais (`npm test` / `pytest`) para validar a matemática antes de prosseguir.
4. **Persistência de Estados:** O estado do simulador _What-If_ deve viver em memória/URL State no Frontend. Já o salvamento de versões e cenários deve persistir estritamente no banco de dados.
5. **Sem Mock em Produção:** Lógica de autenticação, conexões com banco de dados e APIs de faturamento ou exportação devem ser reais e baseadas nas variáveis de ambiente seguras.

### 1.2. Plataformas & Ambiente de Desenvolvimento (Estável)
_Ferramentas e provedores padrão considerados em todo projeto, independente das specs de negócio do Bloco 2. Se um projeto específico precisar de uma plataforma diferente, registrar a exceção na seção 2.6 (Stack Tecnológica) daquele PRD._

- **IDE / Agente de Codificação:** Cursor com Claude Code (terminal).
- **Controle de Versão:** GitHub (repositório privado para o projeto).
- **Banco de Dados / Backend-as-a-Service:** Supabase.
- **Deploy / Hosting:** Vercel.
- **CI/CD:** deploy automático via Vercel a cada push na branch `main`; preview deploy por Pull Request.
- **Gestão de Segredos/Variáveis de Ambiente:** Vercel Environment Variables para produção; `.env.local` fora do versionamento para desenvolvimento.

---

## 2. ESPECIFICAÇÕES DO PRODUTO (EDITÁVEL POR PROJETO)

<!-- ========================================== -->
<!-- INÍCIO DAS ESPECIFICAÇÕES ESPECÍFICAS      -->
<!-- ========================================== -->

### 2.1. Visão Geral e Proposta de Valor
* **Nome do SaaS:** Prumo Viabilidade
* **Público-Alvo:** PMEs de engenharia (obras, montagem eletromecânica), infraestrutura (energia, saneamento, telecom), facilities/serviços técnicos, TI com contrato de projeto — sempre com contrato plurianual ou licitação — faturamento entre R$5M e R$60M/ano e de 15 a 250 funcionários
* **Problema Central:** Transformar PMEs técnicas que perdem margem por falta de estrutura financeira em operações que sabem exatamente o que custam, o que valem e como crescer
* **Entrega de Valor Principal:** SaaS para modelagem, simulação financeira de projetos e tomada de decisão através de relatórios dinâmicos de cronograma físico-financeiro, DRE, fluxo de caixa e cenários preditivos What-If

### 2.2. Parâmetros e Variáveis de Entrada (Inputs)
| Categoria    | Nome do Parâmetro                      | Tipo de Dado                                                       | Obrigatório? | Descrição / Regra de Validação                                                                                                                                              |
| :----------- | :------------------------------------- | :----------------------------------------------------------------- | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cronograma   | Data de Início                         | Data                                                               | Sim          | Marco inicial do item de receita/custo                                                                                                                                      |
| Cronograma   | Duração (meses)                        | Inteiro                                                            | Sim          | Base para o rateio automático da distribuição mensal                                                                                                                        |
| Cronograma   | Quantidade                             | Numérico                                                           | Sim          | Quantidade de unidades do item                                                                                                                                              |
| Cronograma   | Valor Unitário                         | Monetário                                                          | Sim          | Valor por unidade do item                                                                                                                                                   |
| Cronograma   | Alíquota de Impostos (%)               | Percentual                                                         | Sim          | Imposto aplicado sobre o item de receita                                                                                                                                    |
| Financeiro   | Taxa de Desconto do Projeto (VPL)      | Percentual                                                         | Não          | Se nula, o sistema usa a Taxa de Desconto Padrão Global (ver RF008)                                                                                                         |
| Financeiro   | Taxa de Desconto Padrão Global         | Percentual                                                         | Condicional  | Configurada a nível de conta/workspace; usada como fallback quando a taxa do projeto for nula                                                                               |
| Financeiro   | Considerar Custo Financeiro (toggle)   | Booleano                                                           | Sim          | Chave on/off — ver Regra 3 (2.3)                                                                                                                                            |
| Financeiro   | Regime Tributário (IR/CSLL)            | Enum: Lucro Presumido / Lucro Real / Simplificado (Alíquota Única) | Sim          | Definido pelo cliente por projeto. Determina qual ramo da fórmula de IR/CSLL é aplicado (ver 2.3-B)                                                                         |
| Financeiro   | Percentual de Presunção (%)            | Percentual                                                         | Condicional  | Obrigatório apenas se Regime = Lucro Presumido. Ex: 32% para serviços, 8%/12% para comércio/indústria (parametrizável, não hardcoded — muda por atividade e por legislação) |
| Financeiro   | Alíquota Efetiva IR+CSLL (%)           | Percentual                                                         | Condicional  | Obrigatório apenas se Regime = Simplificado (Alíquota Única). Aplicada direto sobre o lucro antes de IR                                                                     |
| Investimento | Capex (valor)                          | Monetário                                                          | Não          | Investimento em ativo fixo. Pode ter mês próprio, distinto do cronograma de receita/custo                                                                                   |
| Investimento | Mês do Capex                           | Data/Mês                                                           | Condicional  | Obrigatório se houver Capex. Pode haver múltiplas parcelas/tranches                                                                                                         |
| Investimento | Variação de Capital de Giro (mensal)   | Monetário                                                          | Não          | Necessidade adicional (ou liberação) de caixa por mês, usada no cálculo de Fluxo de Caixa Livre                                                                             |
| Custos       | Classificação do Custo (Fixo/Variável) | Enum                                                               | Sim          | Necessário para o cálculo de Breakeven Operacional (ver Regra 2, 2.3-B)                                                                                                     |
| Contrato     | Aplica Reajuste Contratual (toggle)    | Booleano                                                           | Sim          | Chave on/off — ver Regra 4 (2.3)                                                                                                                                            |
| Contrato     | Índice de Reajuste                     | Enum: IPCA / INCC-M / IGP-M / Outro (Setorial)                     | Condicional  | Obrigatório se toggle acima = ON. "Outro" permite nome livre para índices de edital específicos                                                                             |
| Contrato     | Periodicidade do Reajuste              | Enum: Anual / Data de Aniversário do Contrato                      | Condicional  | Obrigatório se toggle = ON. Define quando o reajuste é aplicado ao Valor Unitário                                                                                           |
| Contrato     | Mês-base do Reajuste                   | Mês (1-12)                                                         | Condicional  | Obrigatório se toggle = ON. Ex: todo mês de janeiro                                                                                                                         |
| Contrato     | Percentual do Índice por Competência   | Percentual                                                         | Condicional  | Input manual por período (mês/ano em que o reajuste é aplicado). MVP não integra automaticamente com fonte oficial (IBGE/FGV) — ver observação em 2.3-B                     |

### 2.3. Regras de Cálculo e Algoritmos do Sistema
* **Regra 1 (Lógica de Distribuição):** O sistema deve calcular automaticamente a distribuição mensal do cronograma físico-financeiro com base em Data de Início, Duração, Quantidade, Valor Unitário e Impostos de cada item lançado. Capex segue cronograma próprio e independente (mês/tranche definidos separadamente, não rateado pela Duração do item de receita/custo). Variação de Capital de Giro é lançada mês a mês, sem lógica de distribuição — é input direto.
* **Regra 2 (Fórmula do Indicador Core):** O motor de cálculo deve produzir, no mínimo, os seguintes indicadores, recalculados em tempo real a cada alteração: Receita Líquida, EBITDA, EBIT, Lucro Líquido, VPL, Payback (Simples e Descontado) e Breakeven (Ponto de Caixa e Operacional). Fórmulas e convenções definidas e validadas em 2.4.
* **Regra 3 (Cálculo Opcional):**
  * **Chave "Considerar Custo Financeiro":** se ativada, inclui despesas financeiras não operacionais no fluxo de caixa e no resultado; se desativada, desconsidera essas despesas dinamicamente do cálculo.
  * **Resolução da Taxa de Desconto do VPL:** o cálculo deve ler primeiro a taxa do projeto; se nula, ler a taxa padrão global da conta; se ambas forem nulas, o sistema deve suspender o cálculo do VPL e emitir aviso em tela — nunca assumir um valor default silencioso.
* **Regra 4 (Reajuste Contratual):** se "Aplica Reajuste Contratual" = ON, o Valor Unitário de cada item de receita deixa de ser constante ao longo do cronograma e passa a ser corrigido no Mês-base do Reajuste (respeitando a Periodicidade), multiplicando o valor vigente pelo Percentual do Índice informado para aquela competência. Meses fora do mês-base mantêm o valor vigente do reajuste anterior. Fórmula em 2.4.

### 2.4. Fórmulas e Convenções de Cálculo (referência obrigatória para `/core/engine`)
*Este bloco existe para eliminar ambiguidade na implementação. A IA deve seguir exatamente estas definições — não inferir, não simplificar, não usar convenção "genérica" de mercado sem checar aqui primeiro. Todas as decisões abaixo foram validadas.*

**Reajuste Contratual (aplicado antes do cálculo de Receita Líquida, quando ativo):**
```
Se Aplica_Reajuste = ON e mês_t = Mês-base do Reajuste (respeitando Periodicidade):
    Valor_Unitario_t = Valor_Unitario_(t-1) × (1 + Percentual_Indice_Competencia)
Senão:
    Valor_Unitario_t = Valor_Unitario_(t-1)
```
⚠️ Assunção adotada: no MVP, o Percentual do Índice por Competência é **input manual** do usuário (não há integração automática com fonte oficial IPCA/INCC/IGP-M via API do IBGE/FGV nesta versão — regra 1.1.4 do PRD exige "sem mock", então essa integração fica reservada para v2, com escopo e provedor de dados a definir). Se a intenção for automatizar a busca do índice, isso precisa ser tratado como uma nova User Story antes de entrar no MVP.

**Receita Líquida (mensal, por item de receita):**
```
Receita_Liquida = Quantidade × Valor_Unitario_t × (1 - Aliquota_Impostos)
```
`Valor_Unitario_t` é o valor vigente naquele mês — constante se Reajuste Contratual estiver desativado, ou corrigido conforme a regra acima se estiver ativado.

**EBITDA (mensal):**
```
EBITDA = Receita_Liquida_Total - Custos_Operacionais - Despesas_Operacionais
```
Despesas financeiras (juros, IOF, taxas de antecipação) **não** entram aqui — ficam isoladas para o toggle RF009 tratar no Lucro Líquido. (Padrão de mercado — confirmado.)

**EBIT (mensal):**
```
EBIT = EBITDA - Depreciacao - Amortizacao
```

**IR/CSLL (mensal) — depende do Regime Tributário selecionado pelo cliente no cadastro do projeto (input, ver 2.2):**
```
Se Regime = "Simplificado (Alíquota Única)":
    IR_CSLL = Lucro_Antes_IR × Aliquota_Efetiva_IR_CSLL

Se Regime = "Lucro Presumido":
    Base_Calculo = Receita_Bruta × Percentual_Presuncao
    IRPJ = Base_Calculo × 15% + max(0, Base_Calculo - Limite_Mensal_Adicional) × 10%
    CSLL = Base_Calculo × 9%
    IR_CSLL = IRPJ + CSLL

Se Regime = "Lucro Real":
    Base_Calculo = Lucro_Antes_IR  (ajustado por adições/exclusões — fora do escopo do MVP, tratar como Lucro_Antes_IR puro na v1)
    IRPJ = Base_Calculo × 15% + max(0, Base_Calculo - Limite_Mensal_Adicional) × 10%
    CSLL = Base_Calculo × 9%
    IR_CSLL = IRPJ + CSLL
```
⚠️ `Limite_Mensal_Adicional` (hoje R$ 20.000/mês pela legislação vigente) e as alíquotas de 15%/10%/9% devem ser **parâmetros configuráveis no sistema**, nunca hardcoded — mudam por legislação. Lucro Real com ajustes fiscais completos (adições/exclusões da base) fica fora do escopo do MVP; documentar isso como limitação conhecida na tela.

**Lucro Líquido (mensal):**
```
Se toggle "Considerar Custo Financeiro" = ON:
    Lucro_Antes_IR = EBIT - Despesas_Financeiras
Se toggle = OFF:
    Lucro_Antes_IR = EBIT

Lucro_Liquido = Lucro_Antes_IR - IR_CSLL
```

**Fluxo de Caixa Livre (FCL) — base para VPL e Payback Descontado:**
```
FCL_t = Lucro_Liquido_t + Depreciacao_t + Amortizacao_t - Capex_t - ΔCapitalGiro_t
```
Capex entra no mês em que ocorre (ver Regra 1); Variação de Capital de Giro é lançada mês a mês como input direto.

**VPL (Valor Presente Líquido):**
```
taxa_mensal = (1 + taxa_anual)^(1/12) - 1
VPL = Σ [FCL_t / (1 + taxa_mensal)^t]   para t = 0 até duração_meses
```
Taxa informada pelo usuário (projeto/global, ver RF008) é **anual** — conversão para mensal usa juros compostos, nunca divisão simples por 12.

**Payback:**
```
Payback_Simples = primeiro mês em que Caixa_Acumulado ≥ 0
Payback_Descontado = primeiro mês em que Σ[FCL_t / (1+taxa_mensal)^t] ≥ 0
```
Exibir os dois no dashboard e no comparativo (RF-CORE-004): simples mede liquidez, descontado mede viabilidade real considerando o custo de capital.

**Breakeven — exibir os dois cenários, propósitos diferentes:**
```
Breakeven_Ponto_de_Caixa_Mes = primeiro mês em que Caixa_Acumulado ≥ 0   (= Payback Simples)

Margem_Contribuicao_Percentual = (Receita_Liquida - Custos_Variaveis) / Receita_Liquida
Breakeven_Operacional_Receita = Custos_Fixos_Totais / Margem_Contribuicao_Percentual
```
Ponto de Caixa responde "quando o projeto para de consumir caixa"; Operacional responde "que nível de receita cobre os custos fixos, dada a margem de contribuição" — usa a Classificação do Custo (Fixo/Variável) do input (2.2).

**Teste de regressão numérica obrigatório (DoD, item 2):** antes de aprovar o módulo, rodar 2-3 cenários com inputs e resultado esperado calculados manualmente (ou em planilha de referência já validada) e comparar byte a byte com o output do engine para cada um dos indicadores acima — incluindo pelo menos um cenário por Regime Tributário, um cenário com Capex/Capital de Giro não-zero, e um cenário com Reajuste Contratual ativo atravessando pelo menos duas competências de reajuste.

### 2.5. Módulos da Versão 1 (MVP)
- [ ] **Módulo 1:** Cadastro de Projetos e Parâmetros de Receitas e Custos — inclui Regime Tributário, classificação Fixo/Variável por item de custo, cronograma de Capex/Capital de Giro, e parâmetros de Reajuste Contratual (índice, periodicidade, mês-base)
- [ ] **Módulo 2:** Simulador e Cronograma Físico-Financeiro (com engine de distribuição automática e sobrescrita manual), incluindo lançamento de Capex por mês/tranche independente do cronograma de receita/custo e aplicação automática de Reajuste Contratual sobre o Valor Unitário nas competências corretas
- [ ] **Módulo 3:** Dashboards e Painel de Resultados (DRE / Fluxo de Caixa / VPL / Payback Simples e Descontado / Breakeven Ponto de Caixa e Operacional), com drill-down interativo Ano → Mês
- [ ] **Módulo 4:** Comparativo de Cenários (Versões salvas), com os indicadores da Regra 2 lado a lado

### 2.6. Jornada do Usuário
1. Usuário acessa um Projeto e visualiza o painel de parâmetros de Receitas e Custos.
2. Altera um input (ex: imposto de um item de receita de 10% para 12%).
3. Sistema recalcula a distribuição em background e atualiza o Cronograma Físico-Financeiro.
4. No Dashboard, os blocos consolidados iniciam por Ano (Receita, EBITDA, Caixa). Clique no card/barra do "Ano 1" aciona drill-down animado para os meses daquele ano; segundo clique retorna à visão macro.
5. Usuário salva a simulação como Nova Versão.

<!-- ========================================== -->
<!-- FIM DAS ESPECIFICAÇÕES ESPECÍFICAS        -->
<!-- ========================================== -->

---

## 3. REQUISITOS PADRÃO DO SISTEMA (ESTÁVEL)

### 3.1. Requisitos Funcionais de Negócio (Core SaaS)
- [ ] **RF-CORE-001 (Validação Estrita):** Bloquear cálculos ou simulações enquanto campos marcados como obrigatórios não forem preenchidos, destacando as pendências visualmente para o usuário.
- [ ] **RF-CORE-002 (Edição e Sobrescrita Manual):** Permitir que o usuário sobrescreva manualmente células geradas automaticamente pelas engines de cálculo. Células alteradas devem receber a flag `"editado_manualmente": true` e o sistema deve fornecer uma função para restaurar os dados originais calculados automaticamente.
- [ ] **RF-CORE-003 (Persistência e Histórico de Versões):** O sistema não deve sobrescrever dados históricos. O usuário salva estados como novas versões (Snapshots do modelo). Cada versão salva armazena nome, data/hora, usuário responsável, status (Ex: Rascunho, Aprovado) e o snapshot JSON de todos os parâmetros na data do salvamento.
- [ ] **RF-CORE-004 (Comparativo de Cenários):** Permitir selecionar duas ou mais versões do histórico e apresentá-las lado a lado em tabela comparativa com os principais indicadores de resultado do sistema.
- [ ] **RF-CORE-005 (Resolução Hierárquica de Parâmetros):** Parâmetros de cálculo configuráveis devem seguir hierarquia de resolução `Projeto > Workspace/Conta > Sistema`. Se o valor no nível mais específico for nulo, o sistema busca o próximo nível acima. Se todos os níveis retornarem nulo, o cálculo dependente deve ser suspenso e um aviso claro exibido ao usuário — nunca assumir um valor default silencioso.

### 3.2. Requisitos Não-Funcionais
- [ ] **RNF-CORE-001 (Performance):** O recálculo de fórmulas complexas (DRE, Caixa, Margens, VPL) deve ocorrer no client-side ou através de serviços otimizados no backend em menos de 150ms.
- [ ] **RNF-CORE-002 (Design Corporativo Sóbrio):** Interface limpa, executiva, priorizando visualização densa de tabelas e gráficos. Modo claro e escuro devem persistir por preferência do usuário.
- [ ] **RNF-CORE-003 (Responsividade Dinâmica):** Tabelas de dados volumosos devem possuir scroll horizontal suave no mobile, sem quebrar o layout da página.
- [ ] **RNF-CORE-004 (Drill-down em Visualizações Agregadas):** Gráficos e dashboards com dados agregados por período (Ex: Ano) devem suportar drill-down interativo ao nível seguinte (Ex: Mês) via clique/toque, com transição animada e um segundo clique/toque retornando à visão agregada original.

---

## 4. DESIGN SISTÊMICO & PALETA DE CORES (NEVES SOLUÇÕES)
Seguir diretrizes de identidade de marca e design system → `MY_BUSINESS/brand/brand-identity.md`

---

## 5. CONTROLE DE ACESSO, PERFIS (RBAC) E TENANCY

### 5.1. Multi-Tenancy (Arquitetura)
* Toda informação gerada pertence a um `Workspace` (Tenant).
* Usuários estão vinculados a um ou mais Workspaces e não podem visualizar dados de outros Workspaces.
* **Provedor:** NextAuth / Supabase Auth / Clerk. 

### 5.2. Perfis de Usuário (Matriz de Permissões)
| Perfil (Role) | Descrição | Permissões |
| :--- | :--- | :--- |
| **Owner / Admin** | Dono da conta organizacional. | Gestão de faturamento, convite/exclusão de membros e exclusão permanente de projetos. |
| **Analyst / Creator** | Usuário técnico (Consultor/Analista). | Permissão total de escrita. Cria projetos, ajusta premissas, edita tabelas, executa simulações e salva novas versões. |
| **Viewer / Executive** | Usuário de leitura (Tomador de decisão). | Apenas visualiza dashboards, relatórios e tabelas comparativas de cenários. Exporta relatórios. Sem poder de escrita. |

---

## 6. EXPORTAÇÃO, APIS E SAÍDAS DO SISTEMA

### 6.1. Exportação de Dados (DoD de Alta Fidelidade)
O sistema deve conter exportadores nativos que garantam **fidelidade matemática total** (valores exportados devem bater com os valores visualizados em tela):
* **Exportação para Planilha (.xlsx):** Geração de arquivo estruturado em abas com formatação numérica correta (moeda, percentuais e inteiros) para cada visualização ativa (Dashboard, Tabelas Detalhadas e Comparativo de Cenários).
* **Exportação para Documento (.pdf):** Relatório formatado em layout executivo contendo sumário dos parâmetros aplicados e os gráficos renderizados em formato vetorial/alta definição.

---

## 7. DEFINITION OF DONE (DoD) PARA A IA
Para que qualquer tarefa ou módulo seja considerado pronto, os seguintes critérios devem ser cumpridos sem exceção:

1. **Garantia de Coerência de Tipos:** Sem erros de compilação ou alertas no linter (TypeScript ou Python com type annotations ativos).
2. **Conjunto de Testes Básicos de Cálculo:** Testes unitários para o módulo de cálculo (`/core/engine`) que comprovem o comportamento de:
   * Validação de preenchimento obrigatório.
   * Recálculo imediato de saídas ao alterar um parâmetro de entrada.
   * Isolamento de cálculos sob ajustes manuais vs. automáticos.
1. **Persistência de Histórico de Versões:** Garantir via teste de integração que uma versão salva (`ProjectVersion`) nunca seja sobrescritada, apenas novas versões sejam criadas no histórico.
2. **Respeito Visual Estrito:** Toda nova interface ou componente gráfico criado deve herdar a paleta de cores institucional pré-definida e responder corretamente às classes CSS do modo escuro/claro.
