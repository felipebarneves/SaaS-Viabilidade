import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { carregarProjetoComRelacionamentos } from "@/lib/projects/repository";
import { montarProjetoInput } from "@/lib/projects/mapper";
import { carregarParametros, resolverParametrosFiscais, resolverTaxaDescontoPadraoGlobal } from "@/lib/params/resolve";
import { simular } from "@/core/engine";
import { obterRoleNoWorkspace } from "@/lib/auth/rbac";
import { RelatorioPdf } from "@/lib/export/relatorio-pdf";
import { validarProjetoParaSimulacao } from "@/lib/projects/validacao";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const dados = await carregarProjetoComRelacionamentos(supabase, id);
  if (!dados) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const workspaceId = dados.project.workspace_id;
  const role = await obterRoleNoWorkspace(supabase, workspaceId);
  if (!role) return NextResponse.json({ error: "Sem acesso a este workspace." }, { status: 403 });

  const parametros = await carregarParametros(supabase, workspaceId);
  const parametrosFiscais = resolverParametrosFiscais(parametros);
  const taxaPadraoGlobal = resolverTaxaDescontoPadraoGlobal(parametros);
  const validacao = validarProjetoParaSimulacao(dados.project, parametrosFiscais);
  if (!validacao.podeSimular || !parametrosFiscais) {
    return NextResponse.json({ error: validacao.avisos.join(" ") }, { status: 422 });
  }

  const resultado = simular(montarProjetoInput(dados, taxaPadraoGlobal, parametrosFiscais));

  const buffer = await renderToBuffer(RelatorioPdf({ projeto: dados.project, resultado }));
  const nomeArquivo = `${dados.project.nome.replace(/[^a-z0-9]+/gi, "_")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
