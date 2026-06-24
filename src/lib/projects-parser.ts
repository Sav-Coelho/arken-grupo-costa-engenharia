// Parser da planilha "Obras Ativas ECF":
//   Coluna A: Empreendimento (código numérico, ex: 5013)
//   Coluna B: Empreendimento Descrição (ex: "02.201.0097 - BUTANTAN - SPCI E SPDA")
import * as XLSX from 'xlsx'

export interface ParsedProject {
  code: string
  name: string
}

export interface ProjectsParseResult {
  total: number
  projects: ParsedProject[]
  errors: string[]
}

function normalizeHeader(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

export function parseProjects(buffer: ArrayBuffer): ProjectsParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false })

  if (matrix.length === 0) {
    return { total: 0, projects: [], errors: ['Planilha vazia'] }
  }

  // Detecta linha de header (com "EMPREENDIMENTO" na coluna A)
  let headerIdx = -1
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const row = matrix[i] as unknown[]
    if (row && normalizeHeader(row[0]).includes('EMPREENDIMENTO')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) {
    return { total: 0, projects: [], errors: ['Cabeçalho "Empreendimento" não encontrado na coluna A'] }
  }

  const errors: string[] = []
  const projects: ParsedProject[] = []
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[]
    if (!row || row.length === 0) continue
    const code = String(row[0] ?? '').trim()
    const name = String(row[1] ?? '').trim()
    if (!code || !name) continue
    projects.push({ code, name })
  }

  return { total: projects.length, projects, errors }
}
