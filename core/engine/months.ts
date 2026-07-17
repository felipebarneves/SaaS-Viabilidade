// Utilidades de competência mensal ("YYYY-MM"), usadas em todo o engine para alinhar
// itens de cronograma, Capex, Capital de Giro e reajuste a um índice mensal comum.

export function addMonths(mesCompetencia: string, offset: number): string {
  const [ano, mes] = mesCompetencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1 + offset, 1));
  const anoOut = data.getUTCFullYear();
  const mesOut = data.getUTCMonth() + 1;
  return `${anoOut}-${String(mesOut).padStart(2, "0")}`;
}

export function monthIndex(base: string, mesCompetencia: string): number {
  const [baseAno, baseMes] = base.split("-").map(Number);
  const [ano, mes] = mesCompetencia.split("-").map(Number);
  return (ano! - baseAno!) * 12 + (mes! - baseMes!);
}

export function competenciaFromDate(iso: string): string {
  return iso.slice(0, 7);
}

export function mesDoAno(mesCompetencia: string): number {
  return Number(mesCompetencia.split("-")[1]);
}
