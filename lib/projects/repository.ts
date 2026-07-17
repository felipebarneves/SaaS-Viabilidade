import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjetoComRelacionamentos } from "@/lib/projects/mapper";
import type {
  CapexItemRow,
  ContractAdjustmentCompetencyRow,
  DepreciationAmortizationEntryRow,
  FinancialExpenseEntryRow,
  ProjectRow,
  ScheduleItemRow,
  WorkingCapitalEntryRow,
} from "@/lib/types/db";

/** Carrega um projeto e todos os relacionamentos necessários para montar o ProjetoInput. RLS garante o isolamento por Workspace. */
export async function carregarProjetoComRelacionamentos(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjetoComRelacionamentos | null> {
  const [project, scheduleItems, capexItems, workingCapitalEntries, adjustmentCompetencies, depreciationEntries, financialExpenseEntries] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("schedule_items").select("*").eq("project_id", projectId),
      supabase.from("capex_items").select("*").eq("project_id", projectId),
      supabase.from("working_capital_entries").select("*").eq("project_id", projectId),
      supabase.from("contract_adjustment_competencies").select("*").eq("project_id", projectId),
      supabase.from("depreciation_amortization_entries").select("*").eq("project_id", projectId),
      supabase.from("financial_expense_entries").select("*").eq("project_id", projectId),
    ]);

  for (const resultado of [
    project,
    scheduleItems,
    capexItems,
    workingCapitalEntries,
    adjustmentCompetencies,
    depreciationEntries,
    financialExpenseEntries,
  ]) {
    if (resultado.error) throw resultado.error;
  }

  if (!project.data) return null;

  return {
    project: project.data as ProjectRow,
    scheduleItems: (scheduleItems.data ?? []) as ScheduleItemRow[],
    capexItems: (capexItems.data ?? []) as CapexItemRow[],
    workingCapitalEntries: (workingCapitalEntries.data ?? []) as WorkingCapitalEntryRow[],
    adjustmentCompetencies: (adjustmentCompetencies.data ?? []) as ContractAdjustmentCompetencyRow[],
    depreciationEntries: (depreciationEntries.data ?? []) as DepreciationAmortizationEntryRow[],
    financialExpenseEntries: (financialExpenseEntries.data ?? []) as FinancialExpenseEntryRow[],
  };
}
