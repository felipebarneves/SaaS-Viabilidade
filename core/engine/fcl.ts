// Fluxo de Caixa Livre, VPL e Payback — seção 2.4.
// Taxa informada pelo usuário é ANUAL; conversão para mensal via juros compostos (nunca /12 simples).

import type { LinhaMensal, ResultadoVPL, ResultadoPayback, TaxaDescontoVPL } from "./types";

export function calcularFCL(
  lucroLiquido: number,
  depreciacao: number,
  amortizacao: number,
  capex: number,
  variacaoCapitalGiro: number,
): number {
  return lucroLiquido + depreciacao + amortizacao - capex - variacaoCapitalGiro;
}

export function taxaMensalComposta(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

/**
 * Regra 3: resolve a taxa de projeto > taxa padrão global. Se ambas nulas, VPL deve
 * ser suspenso com aviso — nunca assumir default silencioso (RF-CORE-005).
 */
export function resolverTaxaDescontoAnual(taxa: TaxaDescontoVPL): number | null {
  if (taxa.taxaProjeto !== null && taxa.taxaProjeto !== undefined) return taxa.taxaProjeto;
  if (taxa.taxaPadraoGlobalWorkspace !== null && taxa.taxaPadraoGlobalWorkspace !== undefined) {
    return taxa.taxaPadraoGlobalWorkspace;
  }
  return null;
}

export function calcularVPL(
  linhasMensais: LinhaMensal[],
  taxaDesconto: TaxaDescontoVPL,
): ResultadoVPL {
  const taxaAnual = resolverTaxaDescontoAnual(taxaDesconto);
  if (taxaAnual === null) {
    return {
      status: "SUSPENSO",
      motivoSuspensao:
        "Taxa de Desconto do Projeto e Taxa de Desconto Padrão Global estão nulas — cálculo de VPL suspenso.",
    };
  }

  const taxaMensal = taxaMensalComposta(taxaAnual);
  const valor = linhasMensais.reduce(
    (acc, linha) => acc + linha.fcl / Math.pow(1 + taxaMensal, linha.mesIndex),
    0,
  );

  return { status: "CALCULADO", valor };
}

export function calcularPayback(
  linhasMensais: LinhaMensal[],
  taxaDesconto: TaxaDescontoVPL,
): ResultadoPayback {
  const paybackSimplesMes = linhasMensais.find((l) => l.caixaAcumulado >= 0)?.mesIndex;

  const taxaAnual = resolverTaxaDescontoAnual(taxaDesconto);
  let paybackDescontadoMes: number | undefined;
  if (taxaAnual !== null) {
    const taxaMensal = taxaMensalComposta(taxaAnual);
    let acumuladoDescontado = 0;
    for (const linha of linhasMensais) {
      acumuladoDescontado += linha.fcl / Math.pow(1 + taxaMensal, linha.mesIndex);
      if (acumuladoDescontado >= 0) {
        paybackDescontadoMes = linha.mesIndex;
        break;
      }
    }
  }

  return { paybackSimplesMes, paybackDescontadoMes };
}
