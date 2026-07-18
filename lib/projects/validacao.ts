// RF-CORE-001 (Validação Estrita): antes de rodar simular(), garante que os campos
// condicionalmente obrigatórios pelo Regime Tributário estão preenchidos — evita que
// core/engine/dre.ts::calcularIRCSLL lance exceção não tratada (erro 500 cru) e garante
// que o usuário recebe um aviso claro, nunca um valor default silencioso (mesmo espírito
// da suspensão de VPL em RF-CORE-005).

import type { ProjectRow } from "@/lib/types/db";
import type { ParametrosFiscais } from "@/core/engine";

export interface ValidacaoProjeto {
  podeSimular: boolean;
  avisos: string[];
}

export function validarProjetoParaSimulacao(
  project: ProjectRow,
  parametrosFiscais: ParametrosFiscais | null,
): ValidacaoProjeto {
  const avisos: string[] = [];

  if (!parametrosFiscais) {
    avisos.push(
      "Parâmetros fiscais (alíquotas IRPJ/CSLL, limite mensal adicional) não configurados no Workspace nem no Sistema — cálculo de IR/CSLL suspenso.",
    );
  }

  if (project.regime_tributario === "LUCRO_PRESUMIDO" && project.percentual_presuncao == null) {
    avisos.push(
      "Regime Lucro Presumido exige o Percentual de Presunção configurado no projeto — cálculo suspenso até o preenchimento.",
    );
  }

  if (project.regime_tributario === "SIMPLIFICADO_ALIQUOTA_UNICA" && project.aliquota_efetiva_ir_csll == null) {
    avisos.push(
      "Regime Simplificado (Alíquota Única) exige a Alíquota Efetiva IR+CSLL configurada no projeto — cálculo suspenso até o preenchimento.",
    );
  }

  return { podeSimular: avisos.length === 0, avisos };
}
