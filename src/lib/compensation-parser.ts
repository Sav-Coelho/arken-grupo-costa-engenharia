// Parser da planilha "Colaboradores Valores.xlsx":
//
// Aba "Salários":
//   A: COLABORADOR | B: FUNÇÃO | C: MODELO CONTRATO | D: REMUNERAÇÃO (R$/mês)
//
// Aba "Benefícios 1° Quinzena" e "Benefícios 2° Quinzena":
//   A: Funcionários | B: Dias Uteis | C: Custo Unitário (R$/dia) |
//   D: Dias descontados | E: Valor desc. | F: Desconto Diversos |
//   G: Adicional | H: Valor Total Beneficio | I: Forma de Pgto | J: Observações
//
// Merge: nome normalizado (uppercase + sem acentos + trim).
// Quando o nome aparece nas 2 quinzenas com custo unitário diferente,
// usa o da 2ª (mais recente).
import * as XLSX from 'xlsx'

export type ContractType = 'CELETISTA' | 'CONTRATO_PF' | 'PJ' | 'OUTRO'

export interface ParsedCompensation {
  rawName: string                   // nome como aparece no XLSX
  normalizedName: string            // pra matching
  role: string | null
  contractType: ContractType
  contractTypeRaw: string | null    // string original (pra debug)
  monthlySalary: number             // R$
  dailyBenefit: number              // R$/dia (vindo do "Custo Unitário")
  benefitPaymentForm: string | null
}

export interface CompensationParseResult {
  rows: ParsedCompensation[]
  warnings: string[]
  errors: string[]
}

function normalize(s: unknown): string {
  return String(s ?? '').trim()
}

export function normalizeName(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove diacríticos
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')   // colapsa whitespace
}

// Tokens > 1 char, sem partículas
const STOPWORDS = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'EM'])
function tokens(name: string): string[] {
  return normalizeName(name).split(' ').filter(t => t.length > 1 && !STOPWORDS.has(t))
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const sa = new Set(a), sb = new Set(b)
  let inter = 0
  sa.forEach(t => { if (sb.has(t)) inter++ })
  const union = sa.size + sb.size - inter
  return union > 0 ? inter / union : 0
}

// Busca o melhor match em `candidates` pra `target`. Retorna chave + score
// se score >= threshold; null caso contrário. Threshold default 0.5.
export function bestNameMatch(target: string, candidates: Iterable<string>, threshold: number = 0.5): { key: string; score: number } | null {
  const targetTokens = tokens(target)
  let best: { key: string; score: number } | null = null
  Array.from(candidates).forEach(c => {
    const score = jaccard(targetTokens, tokens(c))
    if (score >= threshold && (best === null || score > best.score)) {
      best = { key: c, score }
    }
  })
  return best
}

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    // Trata "R$ 4,300.00", "R$ 4.300,00", "4300", etc.
    let s = v.replace(/R\$/gi, '').trim()
    // Heurística simples: se tem ',' E '.', o último é o decimal
    const hasComma = s.includes(',')
    const hasDot = s.includes('.')
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        // formato BR: 1.234,56 → remove pontos, troca vírgula
        s = s.replace(/\./g, '').replace(',', '.')
      } else {
        // formato US: 1,234.56 → remove vírgulas
        s = s.replace(/,/g, '')
      }
    } else if (hasComma) {
      // só vírgula: assume decimal BR
      s = s.replace(/\./g, '').replace(',', '.')
    }
    s = s.replace(/[^\d.\-]/g, '')
    const n = parseFloat(s)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function classifyContract(raw: string): ContractType {
  const up = raw.toUpperCase()
  if (up.includes('CELETISTA') || up.includes('CLT')) return 'CELETISTA'
  if (up.includes('PJ')) return 'PJ'
  if (up.includes('CONTRATO') || up.includes('PF')) return 'CONTRATO_PF'
  return 'OUTRO'
}

function findSheet(wb: XLSX.WorkBook, predicate: (name: string) => boolean): XLSX.WorkSheet | null {
  const found = wb.SheetNames.find(n => predicate(n.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()))
  return found ? wb.Sheets[found] : null
}

interface BenefitRow { name: string; daily: number; paymentForm: string | null }

function parseBenefitsSheet(ws: XLSX.WorkSheet | null): Map<string, BenefitRow> {
  const map = new Map<string, BenefitRow>()
  if (!ws) return map
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false, defval: '' })
  // Detecta header (linha com "Funcionários" ou similar em col A)
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const a = String(rows[i]?.[0] ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    if (a.startsWith('FUNCION') || a.startsWith('COLAB')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) headerIdx = 0
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    const name = normalize(row[0])
    if (!name) continue
    // Pula linhas de total/observação
    const up = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    if (up.startsWith('OBSERVAC') || up.startsWith('TOTAL') || up.startsWith('*')) continue
    const daily = num(row[2])   // col C: Custo Unitário
    const paymentForm = normalize(row[8]) || null   // col I
    map.set(normalizeName(name), { name, daily, paymentForm })
  }
  return map
}

export function parseCompensation(buffer: ArrayBuffer): CompensationParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellNF: false })

  const salarySheet = findSheet(wb, n => n.includes('SALARIO'))
  if (!salarySheet) {
    return { rows: [], warnings: [], errors: ['Aba "Salários" não encontrada'] }
  }

  // Detecta header da aba Salários
  const salaryMatrix = XLSX.utils.sheet_to_json<unknown[]>(salarySheet, { header: 1, raw: false, blankrows: false, defval: '' })
  let headerIdx = -1
  for (let i = 0; i < Math.min(salaryMatrix.length, 5); i++) {
    const a = String(salaryMatrix[i]?.[0] ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    if (a.includes('COLAB')) { headerIdx = i; break }
  }
  if (headerIdx < 0) {
    return { rows: [], warnings: [], errors: ['Cabeçalho "COLABORADOR" não encontrado na aba Salários'] }
  }

  const ben1 = parseBenefitsSheet(findSheet(wb, n => n.includes('BENEF') && n.includes('1')))
  const ben2 = parseBenefitsSheet(findSheet(wb, n => n.includes('BENEF') && n.includes('2')))

  const warnings: string[] = []
  const rows: ParsedCompensation[] = []
  const seenNames = new Set<string>()

  for (let r = headerIdx + 1; r < salaryMatrix.length; r++) {
    const row = salaryMatrix[r] as unknown[]
    const rawName = normalize(row[0])
    if (!rawName) continue

    // Pula totais/observações
    const upName = rawName.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    if (upName.startsWith('TOTAL') || upName.startsWith('OBSERVAC') || upName.startsWith('*')) continue

    const normalizedName = normalizeName(rawName)
    if (seenNames.has(normalizedName)) {
      warnings.push(`Nome duplicado: "${rawName}"`)
      continue
    }
    seenNames.add(normalizedName)

    const role = normalize(row[1]) || null
    const contractRaw = normalize(row[2]) || null
    const contractType = classifyContract(contractRaw || '')
    const monthlySalary = num(row[3])

    // Benefício: tenta match exato; se falhar, faz fuzzy match (Jaccard de tokens)
    let ben = ben2.get(normalizedName) || ben1.get(normalizedName) || null
    if (!ben) {
      const fuzzy2 = bestNameMatch(normalizedName, Array.from(ben2.keys()))
      if (fuzzy2) { ben = ben2.get(fuzzy2.key)!; warnings.push(`Benefício casado por similaridade: "${rawName}" → "${ben.name}" (score ${fuzzy2.score.toFixed(2)})`) }
      else {
        const fuzzy1 = bestNameMatch(normalizedName, Array.from(ben1.keys()))
        if (fuzzy1) { ben = ben1.get(fuzzy1.key)!; warnings.push(`Benefício casado por similaridade: "${rawName}" → "${ben.name}" (score ${fuzzy1.score.toFixed(2)})`) }
      }
    }
    const dailyBenefit = ben?.daily || 0
    const benefitPaymentForm = ben?.paymentForm || null

    if (!ben) warnings.push(`Sem benefício: "${rawName}"`)
    if (monthlySalary === 0) warnings.push(`Salário zerado: "${rawName}"`)
    if (contractType === 'OUTRO') warnings.push(`Tipo de contrato não reconhecido em "${rawName}": "${contractRaw}"`)

    rows.push({
      rawName, normalizedName, role,
      contractType, contractTypeRaw: contractRaw,
      monthlySalary, dailyBenefit, benefitPaymentForm,
    })
  }

  return { rows, warnings, errors: [] }
}

// ─── Custo por dia ──────────────────────────────────────────
// Retorna o custo diário (salário + benefício) baseado no tipo de contrato.
// salário/dia:
//   - CELETISTA: monthlySalary / 30 (CLT — cobre 7 dias)
//   - CONTRATO_PF/PJ: monthlySalary / 22 (só dias úteis)
// benefício/dia: já é diário no XLSX; aplicado em dia útil
export interface DailyCost {
  salaryPerDay: number
  benefitPerDay: number
  appliesEveryDay: boolean    // true pra CELETISTA, false pra PF/PJ
}

export function dailyCostFor(comp: { contractType: ContractType | string; monthlySalary: number; dailyBenefit: number }): DailyCost {
  const ct = comp.contractType
  const appliesEveryDay = ct === 'CELETISTA'
  const divisor = appliesEveryDay ? 30 : 22
  return {
    salaryPerDay: comp.monthlySalary / divisor,
    benefitPerDay: comp.dailyBenefit,
    appliesEveryDay,
  }
}
