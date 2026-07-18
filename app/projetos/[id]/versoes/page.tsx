import { createClient } from "@/lib/supabase/server";
import type { ProjectVersionRow } from "@/lib/types/db";
import { ComparativoSelecionavel } from "@/app/projetos/[id]/versoes/comparativo-selecionavel";

// RF-CORE-004: comparativo lado a lado dos indicadores de resultado da Regra 2 entre versões salvas.
export default async function VersoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const versoes = (data ?? []) as ProjectVersionRow[];

  if (versoes.length === 0) {
    return <p className="muted">Nenhuma versão salva ainda. Volte ao projeto e clique em "Salvar Versão".</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: "1rem" }}>Comparativo de Cenários</h1>
      <ComparativoSelecionavel versoes={versoes} />
    </div>
  );
}
