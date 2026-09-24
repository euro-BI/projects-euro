import * as XLSX from "xlsx-js-style";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export type NnmMonthlyRow = {
  mes: string; // yyyy-MM
  entradas_cap: number;
  saidas_cap: number;
  entradas_transf: number;
  saidas_transf: number;
  liquida_cap: number;
  liquida_transf: number;
  liquida_total: number;
};

export type NnmDetailRow = {
  mes: string;
  cod_assessor: string;
  nome_assessor: string;
  cod_cliente: string;
  tipo_pessoa: string | null;
  entradas_cap: number;
  saidas_cap: number;
  liquida_cap: number;
  entradas_transf: number;
  saidas_transf: number;
  liquida_transf: number;
  liquida_total: number;
};

function cellStyle(overrides: Record<string, unknown> = {}) {
  return {
    font: { name: "Calibri", sz: 11, color: { rgb: "1F2937" } },
    alignment: { vertical: "center", horizontal: "left" },
    border: {
      top: { style: "thin", color: { rgb: "E5E7EB" } },
      bottom: { style: "thin", color: { rgb: "E5E7EB" } },
      left: { style: "thin", color: { rgb: "E5E7EB" } },
      right: { style: "thin", color: { rgb: "E5E7EB" } },
    },
    ...overrides,
  };
}

function titleStyle() {
  return cellStyle({
    font: { name: "Calibri", sz: 16, bold: true, color: { rgb: "111827" } },
    fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } },
    border: {},
  });
}

function subtitleStyle() {
  return cellStyle({
    font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "6B7280" } },
    fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } },
    border: {},
  });
}

function headerStyle() {
  return cellStyle({
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "111827" } },
    fill: { patternType: "solid", fgColor: { rgb: "FACC15" } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
  });
}

function monthLabel(mes: string) {
  try {
    return format(parseISO(`${mes}-01`), "MMM/yyyy", { locale: ptBR });
  } catch {
    return mes;
  }
}

function styleSheet(
  ws: XLSX.WorkSheet,
  opts: {
    headerRow: number;
    moneyCols: number[];
    totalRow?: number;
  },
) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = 0; r <= range.e.r; r += 1) {
    for (let c = 0; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      if (r === 0) {
        cell.s = titleStyle();
        continue;
      }
      if (r === 1 || r === 2) {
        cell.s = subtitleStyle();
        continue;
      }
      if (r === opts.headerRow) {
        cell.s = headerStyle();
        continue;
      }
      if (r < opts.headerRow) continue;

      const isTotal = opts.totalRow != null && r === opts.totalRow;
      const zebra = r % 2 === 0 ? "FFFFFF" : "F9FAFB";
      const isMoney = opts.moneyCols.includes(c);

      cell.s = cellStyle({
        fill: {
          patternType: "solid",
          fgColor: { rgb: isTotal ? "FEF3C7" : zebra },
        },
        font: {
          name: "Calibri",
          sz: 11,
          bold: isTotal,
          color: { rgb: "1F2937" },
        },
        alignment: {
          vertical: "center",
          horizontal: isMoney || c > 0 ? "right" : "left",
        },
      });

      if (isMoney && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = '"R$"#,##0.00';
      }
    }
  }
}

function buildResumoSheet(
  title: string,
  subtitle: string,
  janela: string,
  headers: string[],
  rows: (string | number)[][],
  moneyCols: number[],
) {
  const aoa: (string | number | null)[][] = [[title], [subtitle], [janela], [], headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 3) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(headers.length - 1, 3) } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(headers.length - 1, 3) } },
  ];
  ws["!freeze"] = { xSplit: 0, ySplit: 5 };
  ws["!cols"] = headers.map((h, i) => ({ wch: i === 0 ? 14 : 16 }));
  ws["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 18 }, { hpt: 8 }, { hpt: 22 }];
  styleSheet(ws, {
    headerRow: 4,
    moneyCols,
    totalRow: rows.length > 0 ? 4 + rows.length : undefined,
  });
  return ws;
}

export function rolling12MonthWindow(referenceDate = new Date()) {
  const end = startOfMonth(referenceDate);
  const start = startOfMonth(subMonths(end, 11));
  return {
    start,
    end,
    startStr: format(start, "yyyy-MM-dd"),
    endStr: format(end, "yyyy-MM-dd"),
    endExclusiveStr: format(startOfMonth(subMonths(end, -1)), "yyyy-MM-dd"),
    label: `${format(start, "MMM/yyyy", { locale: ptBR })} a ${format(end, "MMM/yyyy", { locale: ptBR })}`,
  };
}

export function aggregateNnmMonthly(rows: Array<{
  data_posicao: string;
  captacao_entradas?: number;
  captacao_saidas?: number;
  captacao_entrada_transf?: number;
  captacao_saida_transf?: number;
  captacao_liquida?: number;
  captacao_transf_liquida?: number;
  captacao_liquida_total?: number;
}>): NnmMonthlyRow[] {
  const map = new Map<string, NnmMonthlyRow>();

  rows.forEach((row) => {
    const mes = String(row.data_posicao || "").slice(0, 7);
    if (!mes || mes.length < 7) return;
    const current = map.get(mes) || {
      mes,
      entradas_cap: 0,
      saidas_cap: 0,
      entradas_transf: 0,
      saidas_transf: 0,
      liquida_cap: 0,
      liquida_transf: 0,
      liquida_total: 0,
    };
    current.entradas_cap += Number(row.captacao_entradas) || 0;
    current.saidas_cap += Number(row.captacao_saidas) || 0;
    current.entradas_transf += Number(row.captacao_entrada_transf) || 0;
    current.saidas_transf += Number(row.captacao_saida_transf) || 0;
    current.liquida_cap += Number(row.captacao_liquida) || 0;
    current.liquida_transf += Number(row.captacao_transf_liquida) || 0;
    current.liquida_total += Number(row.captacao_liquida_total) || 0;
    map.set(mes, current);
  });

  return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export function downloadNnmCaptacaoXlsx(opts: {
  monthly: NnmMonthlyRow[];
  detail: NnmDetailRow[];
  janelaLabel: string;
}) {
  const { monthly, detail, janelaLabel } = opts;
  const janela = `Período: ${janelaLabel} (últimos 12 meses)`;

  const sum = (pick: (r: NnmMonthlyRow) => number) =>
    monthly.reduce((acc, row) => acc + pick(row), 0);

  const entradasRows: (string | number)[][] = [
    ...monthly.map((row) => [
      monthLabel(row.mes),
      row.entradas_cap,
      row.entradas_transf,
      row.entradas_cap + row.entradas_transf,
    ]),
    [
      "TOTAL",
      sum((r) => r.entradas_cap),
      sum((r) => r.entradas_transf),
      sum((r) => r.entradas_cap + r.entradas_transf),
    ],
  ];

  const saidasRows: (string | number)[][] = [
    ...monthly.map((row) => [
      monthLabel(row.mes),
      row.saidas_cap,
      row.saidas_transf,
      row.saidas_cap + row.saidas_transf,
    ]),
    [
      "TOTAL",
      sum((r) => r.saidas_cap),
      sum((r) => r.saidas_transf),
      sum((r) => r.saidas_cap + r.saidas_transf),
    ],
  ];

  const liquidoRows: (string | number)[][] = [
    ...monthly.map((row) => [
      monthLabel(row.mes),
      row.liquida_cap,
      row.liquida_transf,
      row.liquida_total,
      row.entradas_cap,
      row.saidas_cap,
      row.entradas_transf,
      row.saidas_transf,
    ]),
    [
      "TOTAL",
      sum((r) => r.liquida_cap),
      sum((r) => r.liquida_transf),
      sum((r) => r.liquida_total),
      sum((r) => r.entradas_cap),
      sum((r) => r.saidas_cap),
      sum((r) => r.entradas_transf),
      sum((r) => r.saidas_transf),
    ],
  ];

  const detailRows: (string | number)[][] = detail.map((row) => [
    monthLabel(row.mes),
    row.cod_assessor,
    row.nome_assessor,
    row.cod_cliente,
    row.tipo_pessoa || "",
    row.entradas_cap,
    row.saidas_cap,
    row.liquida_cap,
    row.entradas_transf,
    row.saidas_transf,
    row.liquida_transf,
    row.liquida_total,
  ]);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    buildResumoSheet(
      "NNM · Entradas (12 meses)",
      "Somente entradas · Captação (relatório cap) + Transferências",
      janela,
      ["Mês", "Entradas Cap", "Entradas Transf", "Entradas Total"],
      entradasRows,
      [1, 2, 3],
    ),
    "Entradas",
  );

  XLSX.utils.book_append_sheet(
    wb,
    buildResumoSheet(
      "NNM · Saídas (12 meses)",
      "Somente saídas · Captação (relatório cap) + Transferências",
      janela,
      ["Mês", "Saídas Cap", "Saídas Transf", "Saídas Total"],
      saidasRows,
      [1, 2, 3],
    ),
    "Saídas",
  );

  XLSX.utils.book_append_sheet(
    wb,
    buildResumoSheet(
      "NNM · Líquido (12 meses)",
      "Líquido separado: relatório Cap vs Transferências · Total = Cap + Transf",
      janela,
      [
        "Mês",
        "Líquido Cap",
        "Líquido Transf",
        "Líquido Total",
        "Entradas Cap",
        "Saídas Cap",
        "Entradas Transf",
        "Saídas Transf",
      ],
      liquidoRows,
      [1, 2, 3, 4, 5, 6, 7],
    ),
    "Líquido",
  );

  const detailHeaders = [
    "Mês",
    "Assessor",
    "Nome Assessor",
    "Cliente",
    "Tipo Pessoa",
    "Entradas Cap",
    "Saídas Cap",
    "Líquido Cap",
    "Entradas Transf",
    "Saídas Transf",
    "Líquido Transf",
    "Líquido Total",
  ];
  const detailAoa: (string | number | null)[][] = [
    ["NNM · Detalhado por cliente (12 meses)"],
    ["Linha a linha: assessor × cliente × mês · Cap e Transf separados"],
    [janela],
    [],
    detailHeaders,
    ...detailRows,
  ];
  const detailWs = XLSX.utils.aoa_to_sheet(detailAoa.length > 5 ? detailAoa : [...detailAoa, ["—"]]);
  detailWs["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
  ];
  detailWs["!freeze"] = { xSplit: 0, ySplit: 5 };
  detailWs["!cols"] = detailHeaders.map((h) => ({
    wch: h.includes("Nome") || h.includes("Cliente") ? 22 : 14,
  }));
  styleSheet(detailWs, {
    headerRow: 4,
    moneyCols: [5, 6, 7, 8, 9, 10, 11],
  });
  XLSX.utils.book_append_sheet(wb, detailWs, "Detalhado");

  const stamp = format(new Date(), "yyyy-MM-dd");
  XLSX.writeFile(wb, `nnm_captacao_12m_${stamp}.xlsx`);
}
