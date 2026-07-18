"use client";

import { excluirProjeto } from "@/app/actions/projects";

export function ExcluirProjetoButton({ projectId, workspaceId, nome }: { projectId: string; workspaceId: string; nome: string }) {
  return (
    <form
      action={excluirProjeto}
      onSubmit={(e) => {
        if (!confirm(`Excluir permanentemente o projeto "${nome}"? Essa ação remove todo o histórico de versões e não pode ser desfeita.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <button className="btn-secondary btn" type="submit" style={{ borderColor: "var(--negative)", color: "var(--negative)" }}>
        Excluir Projeto
      </button>
    </form>
  );
}
