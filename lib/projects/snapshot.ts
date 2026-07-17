// RF-CORE-003: shape do snapshot JSON salvo em project_versions. Nunca sobrescrito —
// cada "Salvar Versão" grava um novo registro com os parâmetros de entrada E os
// indicadores de resultado já calculados na data do salvamento (para comparação
// rápida em RF-CORE-004 sem precisar re-simular versões antigas).

import type { ProjetoInput, ResultadoSimulacao } from "@/core/engine";

export interface ProjectVersionSnapshot {
  input: ProjetoInput;
  resultado: ResultadoSimulacao;
  salvoEm: string; // ISO datetime
}
