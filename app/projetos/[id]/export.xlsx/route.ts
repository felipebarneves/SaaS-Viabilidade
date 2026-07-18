import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { carregarProjetoComRelacionamentos } from "@/lib/projects/repository";
import { montarProjetoInput } from "@/lib/projects/mapper";
import { carregarParametros, resolverParametrosFiscais, resolverTaxaDescontoPadraoGlobal } from "@/lib/params/resolve";
import { simular } from "@/core/engine";
import { obterRoleNoWorkspace } from "@/lib/auth/rbac";
import { validarProjetoParaSimulacao } from "@/lib/projects/validacao";

const MOEDA = '"R$" #,##0.00';
const PERCENTUAL = "0.0%";
const INTEIRO = "0";

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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Prumo Viabilidade";
  workbook.created = new Date();

  const dashboard = workbook.addWorksheet("Dashboard");
  dashboard.columns = [
    { header: "Indicador", key: "indicador", width: 28 },
    { header: "Valor", key: "valor", width: 20 },
  ];
  dashboard.addRow({
    indicador: "VPL",
    valor: resultado.vpl.status === "CALCULADO" ? resultado.vpl.valor : null,
  }).getCell("valor").numFmt = MOEDA;
  dashboard.addRow({
    indicador: "Payback Simples (mês)",
    valor: resultado.payback.paybackSimplesMes ?? null,
  }).getCell("valor").numFmt = INTEIRO;
  dashboard.addRow({
    indicador: "Payback Descontado (mês)",
    valor: resultado.payback.paybackDescontadoMes ?? null,
  }).getCell("valor").numFmt = INTEIRO;
  dashboard.addRow({
    indicador: "Breakeven Ponto de Caixa (mês)",
    valor: resultado.breakeven.pontoDeCaixaMes ?? null,
  }).getCell("valor").numFmt = INTEIRO;
  dashboard.addRow({
    indicador: "Breakeven Operacional (Receita)",
    valor: resultado.breakeven.operacionalReceita ?? null,
  }).getCell("valor").numFmt = MOEDA;
  dashboard.getRow(1).font = { bold: true };

  const mensal = workbook.addWorksheet("Tabela Mensal");
  mensal.columns = [
    { header: "Competência", key: "mesCompetencia", width: 14 },
    { header: "Receita Líquida", key: "receitaLiquida", width: 16 },
    { header: "Custos Operacionais", key: "custosOperacionais", width: 18 },
    { header: "Despesas Operacionais", key: "despesasOperacionais", width: 20 },
    { header: "EBITDA", key: "ebitda", width: 14 },
    { header: "Depreciação", key: "depreciacao", width: 14 },
    { header: "Amortização", key: "amortizacao", width: 14 },
    { header: "EBIT", key: "ebit", width: 14 },
    { header: "Despesas Financeiras", key: "despesasFinanceiras", width: 18 },
    { header: "Lucro Antes IR", key: "lucroAntesIR", width: 16 },
    { header: "IR/CSLL", key: "irCsll", width: 14 },
    { header: "Lucro Líquido", key: "lucroLiquido", width: 16 },
    { header: "Capex", key: "capex", width: 14 },
    { header: "Variação Capital de Giro", key: "variacaoCapitalGiro", width: 20 },
    { header: "FCL", key: "fcl", width: 14 },
    { header: "Caixa Acumulado", key: "caixaAcumulado", width: 16 },
  ];
  mensal.getRow(1).font = { bold: true };
  const colunasMoeda = mensal.columns.slice(1).map((c) => c.key as string);
  for (const linha of resultado.linhasMensais) {
    const row = mensal.addRow(linha);
    for (const key of colunasMoeda) {
      row.getCell(key).numFmt = MOEDA;
    }
  }

  const cronograma = workbook.addWorksheet("Cronograma");
  cronograma.columns = [
    { header: "Tipo", key: "tipo", width: 22 },
    { header: "Classificação", key: "classificacao", width: 14 },
    { header: "Início", key: "inicio", width: 14 },
    { header: "Duração (meses)", key: "duracao", width: 16 },
    { header: "Quantidade", key: "quantidade", width: 14 },
    { header: "Valor Unitário", key: "valorUnitario", width: 16 },
    { header: "Impostos", key: "impostos", width: 12 },
    { header: "Editado Manualmente", key: "editado", width: 18 },
  ];
  cronograma.getRow(1).font = { bold: true };
  for (const item of dados.scheduleItems) {
    const row = cronograma.addRow({
      tipo: item.tipo,
      classificacao: item.classificacao_custo ?? "—",
      inicio: item.data_inicio,
      duracao: item.duracao_meses,
      quantidade: item.quantidade,
      valorUnitario: item.valor_unitario,
      impostos: item.aliquota_impostos,
      editado: item.editado_manualmente ? "Sim" : "—",
    });
    row.getCell("valorUnitario").numFmt = MOEDA;
    row.getCell("impostos").numFmt = PERCENTUAL;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const nomeArquivo = `${dados.project.nome.replace(/[^a-z0-9]+/gi, "_")}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
