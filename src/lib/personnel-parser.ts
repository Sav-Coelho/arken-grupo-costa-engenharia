// Parser da planilha "Relação Pessoal de Obra":
//
// Layout esperado:
//   Linha 0: vazio | vazio | dias da semana ("Sex", "Sáb", "Dom", "Seg", ...)
//   Linha 1: "COLABORADOR" | "FUNÇÃO" | "1" | "2" | "3" | ... | "31"
//   Linhas 2+: <nome> | <função> | <célula por dia>
//
// Cada célula dia×colaborador pode ter:
//   - vazio       → WEEKEND (sáb/dom) ou DAY_OFF (meio de semana — convencionado)
//   - "FALTA JUSTIF." (ou variantes)        → ABSENCE_JUSTIFIED
//   - "FALTA NÃO JUSTIF." (ou variantes)    → ABSENCE_UNJUSTIFIED
//   - "DESLIGADO"                            → TERMINATED
//   - qualquer outra string                  → PRESENT, e o texto é o alias da obra
import * as XLSX from 'xlsx'

export type AllocationStatus =
  | 'PRESENT'
  | 'WEEKEND'
  | 'DAY_OFF'
  | 'ABSENCE_JUSTIFIED'
  | 'ABSENCE_UNJUSTIFIED'
  | 'TERMINATED'

export interface ParsedAllocation {
  day: number                       // 1-31
  date: string                      // YYYY-MM-DD
  status: AllocationStatus
  alias: string | null              // nome curto da obra (só se PRESENT)
  rawValue: string                  // valor original da célula
}

export interface ParsedWorker {
  name: string
  role: string | null
  allocations: ParsedAllocation[]
}

export interface PersonnelParseResult {
  year: number
  month: number                     // 1-12
  daysInMonth: number
  workers: ParsedWorker[]
  uniqueAliases: string[]           // nomes de obras distintos encontrados
  errors: string[]
}

function normalize(s: unknown): string {
  return String(s ?? '').trim()
}

function normalizeUpper(s: unknown): string {
  return normalize(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function isWeekend(year: number, month: number, day: number): boolean {
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return wd === 0 || wd === 6
}

function classifyCell(raw: string, weekend: boolean): { status: AllocationStatus; alias: string | null } {
  const up = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  if (!up) return { status: weekend ? 'WEEKEND' : 'DAY_OFF', alias: null }
  if (up === 'DESLIGADO' || up.includes('DESLIG')) return { status: 'TERMINATED', alias: null }
  if (up.includes('FALTA') && (up.includes('NAO JUST') || up.includes('NÃO JUST') || up.includes('N JUST'))) {
    return { status: 'ABSENCE_UNJUSTIFIED', alias: null }
  }
  if (up.includes('FALTA')) {
    return { status: 'ABSENCE_JUSTIFIED', alias: null }
  }
  // Qualquer outra coisa: presença com a string como alias da obra
  return { status: 'PRESENT', alias: raw.trim() }
}

export function parsePersonnel(buffer: ArrayBuffer, year: number, month: number): PersonnelParseResult {
  if (month < 1 || month > 12) {
    return { year, month, daysInMonth: 0, workers: [], uniqueAliases: [], errors: [`Mês inválido: ${month}`] }
  }
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false, defval: '' })

  if (matrix.length < 2) {
    return { year, month, daysInMonth: 0, workers: [], uniqueAliases: [], errors: ['Planilha vazia ou sem cabeçalho'] }
  }

  // Detecta linha "COLABORADOR | FUNÇÃO | 1 | 2 | …"
  let headerIdx = -1
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const row = matrix[i] as unknown[]
    const a = normalizeUpper(row?.[0])
    const b = normalizeUpper(row?.[1])
    if (a.includes('COLABORADOR') && b.includes('FUNCAO')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) {
    return { year, month, daysInMonth: 0, workers: [], uniqueAliases: [], errors: ['Cabeçalho "COLABORADOR | FUNÇÃO" não encontrado'] }
  }

  const dim = daysInMonth(year, month)
  // Colunas C, D, ... = dias 1, 2, ... A coluna do dia D está em índice (D + 1) (0-based)
  // pois A=0, B=1, C=2 corresponde a dia 1
  const errors: string[] = []
  const workers: ParsedWorker[] = []
  const aliasesSet = new Set<string>()

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[]
    if (!row || row.length === 0) continue
    const name = normalize(row[0])
    if (!name) continue
    const role = normalize(row[1]) || null

    const allocations: ParsedAllocation[] = []
    for (let d = 1; d <= dim; d++) {
      const col = d + 1                       // coluna 0-based
      const raw = normalize(row[col])
      const weekend = isWeekend(year, month, d)
      const { status, alias } = classifyCell(raw, weekend)
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (alias) aliasesSet.add(alias)
      allocations.push({ day: d, date: isoDate, status, alias, rawValue: raw })
    }
    workers.push({ name, role, allocations })
  }

  return {
    year, month, daysInMonth: dim,
    workers,
    uniqueAliases: Array.from(aliasesSet).sort(),
    errors,
  }
}
