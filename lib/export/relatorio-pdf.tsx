import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Polyline, Circle } from "@react-pdf/renderer";
import type { ResultadoSimulacao } from "@/core/engine";
import type { ProjectRow } from "@/lib/types/db";
import { formatarMoeda, formatarPercentual } from "@/lib/format";

const REGIME_LABEL: Record<ProjectRow["regime_tributario"], string> = {
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  SIMPLIFICADO_ALIQUOTA_UNICA: "Simplificado (Alíquota Única)",
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  h1: { fontSize: 18, marginBottom: 4, fontWeight: 700 },
  h2: { fontSize: 13, marginTop: 18, marginBottom: 8, fontWeight: 700 },
  muted: { color: "#666666", marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 220, color: "#444444" },
  value: { fontWeight: 700 },
  indicadoresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  indicadorCard: { border: "1 solid #dddddd", borderRadius: 4, padding: 8, width: 150 },
  indicadorTitulo: { color: "#666666", fontSize: 8, marginBottom: 4 },
  indicadorValor: { fontSize: 12, fontWeight: 700 },
  chartLegend: { flexDirection: "row", gap: 12, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendSwatch: { width: 8, height: 8 },
  legendLabel: { fontSize: 8, color: "#444444" },
  table: { marginTop: 8 },
  tr: { flexDirection: "row", borderBottom: "1 solid #eeeeee", paddingVertical: 3 },
  th: { fontSize: 8, fontWeight: 700, color: "#444444" },
  td: { fontSize: 8 },
});

const CHART_W = 500;
const CHART_H = 180;
const COR_FCL = "#2563eb";
const COR_CAIXA = "#16a34a";

function escalaEixoY(valores: number[]) {
  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, 0);
  const amplitude = max - min || 1;
  return { max, min, amplitude };
}

function GraficoBarrasFcl({ linhas }: { linhas: ResultadoSimulacao["linhasMensais"] }) {
  const valores = linhas.map((l) => l.fcl);
  const { max, min, amplitude } = escalaEixoY(valores);
  const zeroY = CHART_H - ((0 - min) / amplitude) * CHART_H;
  const larguraBarra = Math.min(24, (CHART_W - 20) / linhas.length - 4);

  return (
    <Svg width={CHART_W} height={CHART_H + 20}>
      <Line x1={0} y1={zeroY} x2={CHART_W} y2={zeroY} stroke="#cccccc" strokeWidth={1} />
      {linhas.map((linha, i) => {
        const alturaBarra = (Math.abs(linha.fcl) / amplitude) * CHART_H;
        const x = i * (larguraBarra + 4);
        const y = linha.fcl >= 0 ? zeroY - alturaBarra : zeroY;
        return <Rect key={linha.mesCompetencia} x={x} y={y} width={larguraBarra} height={Math.max(alturaBarra, 0.5)} fill={COR_FCL} />;
      })}
    </Svg>
  );
}

function GraficoLinhaCaixaAcumulado({ linhas }: { linhas: ResultadoSimulacao["linhasMensais"] }) {
  const valores = linhas.map((l) => l.caixaAcumulado);
  const { max, min, amplitude } = escalaEixoY(valores);
  const passoX = linhas.length > 1 ? CHART_W / (linhas.length - 1) : CHART_W;
  const pontos = linhas
    .map((linha, i) => {
      const x = i * passoX;
      const y = CHART_H - ((linha.caixaAcumulado - min) / amplitude) * CHART_H;
      return `${x},${y}`;
    })
    .join(" ");
  const zeroY = CHART_H - ((0 - min) / amplitude) * CHART_H;

  return (
    <Svg width={CHART_W} height={CHART_H + 20}>
      <Line x1={0} y1={zeroY} x2={CHART_W} y2={zeroY} stroke="#cccccc" strokeWidth={1} />
      <Polyline points={pontos} stroke={COR_CAIXA} strokeWidth={2} fill="none" />
      {linhas.map((linha, i) => {
        const x = i * passoX;
        const y = CHART_H - ((linha.caixaAcumulado - min) / amplitude) * CHART_H;
        return <Circle key={linha.mesCompetencia} cx={x} cy={y} r={2} fill={COR_CAIXA} />;
      })}
    </Svg>
  );
}

export function RelatorioPdf({ projeto, resultado }: { projeto: ProjectRow; resultado: ResultadoSimulacao }) {
  return (
    <Document title={`Relatório de Viabilidade — ${projeto.nome}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{projeto.nome}</Text>
        <Text style={styles.muted}>Relatório de Viabilidade Financeira — Prumo Viabilidade</Text>

        <Text style={styles.h2}>Parâmetros Aplicados</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Duração</Text>
          <Text style={styles.value}>{projeto.duracao_meses} meses</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Regime Tributário</Text>
          <Text style={styles.value}>{REGIME_LABEL[projeto.regime_tributario]}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Considera Custo Financeiro</Text>
          <Text style={styles.value}>{projeto.considerar_custo_financeiro ? "Sim" : "Não"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Taxa de Desconto do Projeto (VPL)</Text>
          <Text style={styles.value}>
            {projeto.taxa_desconto_projeto != null ? formatarPercentual(projeto.taxa_desconto_projeto) : "— (usa taxa padrão do Workspace)"}
          </Text>
        </View>

        <Text style={styles.h2}>Indicadores</Text>
        <View style={styles.indicadoresGrid}>
          <View style={styles.indicadorCard}>
            <Text style={styles.indicadorTitulo}>VPL</Text>
            <Text style={styles.indicadorValor}>
              {resultado.vpl.status === "CALCULADO" ? formatarMoeda(resultado.vpl.valor!) : "Suspenso"}
            </Text>
          </View>
          <View style={styles.indicadorCard}>
            <Text style={styles.indicadorTitulo}>Payback Simples</Text>
            <Text style={styles.indicadorValor}>
              {resultado.payback.paybackSimplesMes !== undefined ? `Mês ${resultado.payback.paybackSimplesMes}` : "Não atingido"}
            </Text>
          </View>
          <View style={styles.indicadorCard}>
            <Text style={styles.indicadorTitulo}>Payback Descontado</Text>
            <Text style={styles.indicadorValor}>
              {resultado.payback.paybackDescontadoMes !== undefined ? `Mês ${resultado.payback.paybackDescontadoMes}` : "Não atingido"}
            </Text>
          </View>
          <View style={styles.indicadorCard}>
            <Text style={styles.indicadorTitulo}>Breakeven Ponto de Caixa</Text>
            <Text style={styles.indicadorValor}>
              {resultado.breakeven.pontoDeCaixaMes !== undefined ? `Mês ${resultado.breakeven.pontoDeCaixaMes}` : "Não atingido"}
            </Text>
          </View>
          <View style={styles.indicadorCard}>
            <Text style={styles.indicadorTitulo}>Breakeven Operacional</Text>
            <Text style={styles.indicadorValor}>
              {resultado.breakeven.operacionalReceita !== undefined ? formatarMoeda(resultado.breakeven.operacionalReceita) : "—"}
            </Text>
          </View>
        </View>

        <Text style={styles.h2}>Fluxo de Caixa Livre (FCL) Mensal</Text>
        <GraficoBarrasFcl linhas={resultado.linhasMensais} />
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={{ ...styles.legendSwatch, backgroundColor: COR_FCL }} />
            <Text style={styles.legendLabel}>FCL por mês (barras acima/abaixo da linha zero)</Text>
          </View>
        </View>

        <Text style={styles.h2}>Caixa Acumulado</Text>
        <GraficoLinhaCaixaAcumulado linhas={resultado.linhasMensais} />
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={{ ...styles.legendSwatch, backgroundColor: COR_CAIXA }} />
            <Text style={styles.legendLabel}>Caixa acumulado ao longo do horizonte</Text>
          </View>
        </View>

        <Text
          style={{ position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#999999", textAlign: "center" }}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Tabela Mensal Detalhada</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={{ ...styles.th, width: 55 }}>Competência</Text>
            <Text style={{ ...styles.th, width: 70, textAlign: "right" }}>Receita Líq.</Text>
            <Text style={{ ...styles.th, width: 65, textAlign: "right" }}>EBITDA</Text>
            <Text style={{ ...styles.th, width: 65, textAlign: "right" }}>EBIT</Text>
            <Text style={{ ...styles.th, width: 70, textAlign: "right" }}>Lucro Líq.</Text>
            <Text style={{ ...styles.th, width: 60, textAlign: "right" }}>FCL</Text>
            <Text style={{ ...styles.th, width: 75, textAlign: "right" }}>Caixa Acum.</Text>
          </View>
          {resultado.linhasMensais.map((linha) => (
            <View style={styles.tr} key={linha.mesCompetencia}>
              <Text style={{ ...styles.td, width: 55 }}>{linha.mesCompetencia}</Text>
              <Text style={{ ...styles.td, width: 70, textAlign: "right" }}>{formatarMoeda(linha.receitaLiquida)}</Text>
              <Text style={{ ...styles.td, width: 65, textAlign: "right" }}>{formatarMoeda(linha.ebitda)}</Text>
              <Text style={{ ...styles.td, width: 65, textAlign: "right" }}>{formatarMoeda(linha.ebit)}</Text>
              <Text style={{ ...styles.td, width: 70, textAlign: "right" }}>{formatarMoeda(linha.lucroLiquido)}</Text>
              <Text style={{ ...styles.td, width: 60, textAlign: "right" }}>{formatarMoeda(linha.fcl)}</Text>
              <Text style={{ ...styles.td, width: 75, textAlign: "right" }}>{formatarMoeda(linha.caixaAcumulado)}</Text>
            </View>
          ))}
        </View>
        <Text
          style={{ position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#999999", textAlign: "center" }}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
