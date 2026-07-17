// Tipos do motor de cálculo — espelham estritamente a seção 2.2 (Inputs) e 2.3/2.4 (Regras/Fórmulas)
// do prd-spec-viabilidade.md. Nenhuma regra de negócio deve ser reimplementada fora deste módulo.

export type RegimeTributario =
  | "LUCRO_PRESUMIDO"
  | "LUCRO_REAL"
  | "SIMPLIFICADO_ALIQUOTA_UNICA";

export type ClassificacaoCusto = "FIXO" | "VARIAVEL";

export type IndiceReajuste = "IPCA" | "INCC_M" | "IGP_M" | "OUTRO";

export type PeriodicidadeReajuste = "ANUAL" | "ANIVERSARIO_CONTRATO";

export type TipoItem = "RECEITA" | "CUSTO" | "DESPESA_OPERACIONAL";

/** Item de cronograma físico-financeiro (Regra 1). Custos/Despesas usam a mesma forma de rateio. */
export interface ItemCronograma {
  id: string;
  tipo: TipoItem;
  /** Obrigatório apenas para tipo = CUSTO/DESPESA_OPERACIONAL (Regra 2, Breakeven Operacional) */
  classificacaoCusto?: ClassificacaoCusto;
  dataInicio: string; // ISO date, marco inicial do item
  duracaoMeses: number;
  quantidade: number;
  valorUnitario: number;
  aliquotaImpostos: number; // fração 0-1, aplicada somente a itens de RECEITA
}

/** Parcela/tranche de Capex — cronograma próprio, independente do rateio por Duração (Regra 1). */
export interface CapexItem {
  id: string;
  valor: number;
  mesCompetencia: string; // "YYYY-MM"
}

/** Variação de Capital de Giro — input direto mês a mês, sem lógica de distribuição (Regra 1). */
export interface VariacaoCapitalGiro {
  mesCompetencia: string; // "YYYY-MM"
  valor: number; // positivo = necessidade adicional de caixa; negativo = liberação
}

/** Percentual do índice de reajuste informado manualmente por competência (2.2, 2.4 nota MVP). */
export interface ReajusteCompetencia {
  mesCompetencia: string; // "YYYY-MM" em que o reajuste é aplicado
  percentualIndice: number; // fração 0-1
}

export interface ConfiguracaoReajusteContratual {
  aplicaReajuste: boolean;
  indice?: IndiceReajuste;
  indiceOutroNome?: string; // livre, quando indice = OUTRO
  periodicidade?: PeriodicidadeReajuste;
  mesBase?: number; // 1-12
  competencias: ReajusteCompetencia[];
}

/** Parâmetros configuráveis por legislação — nunca hardcoded no engine (2.4, nota ⚠️). */
export interface ParametrosFiscais {
  limiteMensalAdicionalIRPJ: number; // hoje R$ 20.000/mês
  aliquotaIRPJBase: number; // 15%
  aliquotaIRPJAdicional: number; // 10%
  aliquotaCSLL: number; // 9%
}

export interface ConfiguracaoTributaria {
  regime: RegimeTributario;
  /** Obrigatório apenas se regime = LUCRO_PRESUMIDO */
  percentualPresuncao?: number;
  /** Obrigatório apenas se regime = SIMPLIFICADO_ALIQUOTA_UNICA */
  aliquotaEfetivaIRCSLL?: number;
  parametrosFiscais: ParametrosFiscais;
}

/** Depreciação/Amortização mensal, se aplicável ao projeto (linha do EBIT / FCL). */
export interface DepreciacaoAmortizacao {
  mesCompetencia: string; // "YYYY-MM"
  depreciacao: number;
  amortizacao: number;
}

/** Despesas financeiras mensais, usadas somente se o toggle RF009 estiver ON. */
export interface DespesaFinanceira {
  mesCompetencia: string; // "YYYY-MM"
  valor: number;
}

/**
 * Resolução hierárquica de parâmetros (RF-CORE-005): Projeto > Workspace > Sistema.
 * `null`/`undefined` em cada nível cai para o próximo; se todos forem nulos, o cálculo
 * dependente deve ser suspenso (nunca assumir default silencioso).
 */
export interface TaxaDescontoVPL {
  taxaProjeto?: number | null; // anual, fração 0-1
  taxaPadraoGlobalWorkspace?: number | null; // anual, fração 0-1
}

export interface ProjetoInput {
  id: string;
  duracaoMeses: number;
  itensCronograma: ItemCronograma[];
  capex: CapexItem[];
  variacaoCapitalGiro: VariacaoCapitalGiro[];
  reajusteContratual: ConfiguracaoReajusteContratual;
  tributacao: ConfiguracaoTributaria;
  considerarCustoFinanceiro: boolean; // toggle Regra 3
  despesasFinanceiras: DespesaFinanceira[];
  depreciacaoAmortizacao: DepreciacaoAmortizacao[];
  taxaDescontoVPL: TaxaDescontoVPL;
}

export interface LinhaMensal {
  mesCompetencia: string; // "YYYY-MM"
  mesIndex: number; // 0-based, alinhado ao horizonte de simulação
  receitaLiquida: number;
  custosOperacionais: number;
  despesasOperacionais: number;
  ebitda: number;
  depreciacao: number;
  amortizacao: number;
  ebit: number;
  despesasFinanceiras: number;
  lucroAntesIR: number;
  irCsll: number;
  lucroLiquido: number;
  capex: number;
  variacaoCapitalGiro: number;
  fcl: number;
  caixaAcumulado: number;
}

export interface ResultadoVPL {
  status: "CALCULADO" | "SUSPENSO";
  valor?: number;
  motivoSuspensao?: string;
}

export interface ResultadoPayback {
  paybackSimplesMes?: number; // undefined = não atingido no horizonte
  paybackDescontadoMes?: number;
}

export interface ResultadoBreakeven {
  pontoDeCaixaMes?: number;
  operacionalReceita?: number;
  margemContribuicaoPercentual?: number;
}

export interface ResultadoSimulacao {
  linhasMensais: LinhaMensal[];
  vpl: ResultadoVPL;
  payback: ResultadoPayback;
  breakeven: ResultadoBreakeven;
}
