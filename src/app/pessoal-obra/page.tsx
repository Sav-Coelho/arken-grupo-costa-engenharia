'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Shell from '@/components/Shell'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'

type Tab = 'view' | 'import'

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                     'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']  // dom seg ter qua qui sex sab

const C = {
  navy: '#0a2540', navyMid: '#142c4e', navyLight: '#1e3a5f',
  gold: '#d4a017', yellow: '#f5c518',
  line: '#e3e7ed', textSoft: '#4a5670', textMuted: '#7a869a',
  green: '#197a4a', red: '#b03022', amber: '#c98a14', orange: '#d97e1a',
  weekendBg: '#eceff3', dayOffBg: '#dde2ea', terminatedBg: '#3a3f4a',
}

// Paleta de cores pras obras — sequencial, derivada de hue evenly-spaced
const PROJECT_COLORS = [
  '#2f5a96', '#197a4a', '#a3520b', '#7c2e8e', '#1e6e8c',
  '#8a6a14', '#a32a4c', '#3d6e2f', '#5a3a8e', '#0f6e6e',
  '#7a4a14', '#3d4a7c', '#6e2e2e', '#2e6e3d', '#7c1e6e',
]

// ─── Types ────────────────────────────────────────────────
type WorkerRow = { id: number; name: string; role: string | null; active: boolean }
type Project = { id: number; code: string; name: string; active: boolean }
type AllocRow = {
  workerId: number; day: number; date: string
  projectId: number | null; status: string; rawValue: string | null
}
type Period = { year: number; month: number; count: number }
type SeriesResponse = {
  availablePeriods: Period[]
  year: number | null; month: number | null; daysInMonth: number
  workers: WorkerRow[]
  allocations: AllocRow[]
  projects: Project[]
  summary: {
    workerCount: number
    presentDays: number
    absenceJustified: number
    absenceUnjustified: number
    terminated: number
    dayOff: number
    weekend: number
  }
}

type ParsedWorker = {
  name: string; role: string | null
  allocations: { day: number; date: string; status: string; alias: string | null; rawValue: string }[]
}
type ParseResponse = {
  year: number; month: number; day: number | null; daysInMonth: number
  workers: ParsedWorker[]
  uniqueAliases: string[]
  existingMappings: Record<string, number>
  pendingAliases: string[]
  activeProjects: { id: number; code: string; name: string }[]
  summary: { workerCount: number; totalPresent: number; totalAbsent: number; totalTerminated: number }
}

function daysInMonthOf(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

// ─── Página ───────────────────────────────────────────────
export default function PessoalObra() {
  const [tab, setTab] = useState<Tab>('view')
  const [series, setSeries] = useState<SeriesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000) }

  const load = async (y: number | null = year, m: number | null = month, pIds: Set<number> = selectedProjectIds) => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (y) qs.set('year', String(y))
    if (m) qs.set('month', String(m))
    if (pIds.size > 0) qs.set('projectIds', Array.from(pIds).join(','))
    const d: SeriesResponse = await fetch(`/api/personnel/series?${qs}`).then(r => r.json())
    setSeries(d)
    if (!y && !m && d.availablePeriods.length > 0) {
      const p = d.availablePeriods[0]
      setYear(p.year); setMonth(p.month)
      // recursivamente carrega com o período mais recente
      load(p.year, p.month, pIds)
      return
    }
    setLoading(false)
  }
  useEffect(() => { load(null, null, new Set()) }, [])

  const toggleProject = (id: number) => {
    const next = new Set(selectedProjectIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedProjectIds(next)
    load(year, month, next)
  }
  const clearProjects = () => {
    setSelectedProjectIds(new Set())
    load(year, month, new Set())
  }

  const setPeriod = (y: number, m: number) => {
    setYear(y); setMonth(m)
    load(y, m, selectedProjectIds)
  }

  return (
    <Shell>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Módulo · Pessoal</div>
          <h1 className="page-title">Pessoal por Obra</h1>
          <p className="page-subtitle">
            Acompanhamento de alocação diária de colaboradores nas obras ativas. Upload do XLSX
            mensal de RH, mapeamento automático de obras já conhecidas e dashboard com heatmap
            diário, distribuição por função e indicadores de presença/falta.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['view', 'Visão Geral'], ['import', 'Importar']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} className={tab === k ? 'btn btn-primary' : 'btn'} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'import' && (
        <ImportPanel showToast={showToast} onSaved={(y, m) => { setTab('view'); setPeriod(y, m) }} />
      )}
      {tab === 'view' && (
        loading
          ? <Loading />
          : series
            ? <ViewPanel series={series} selectedProjectIds={selectedProjectIds}
                onToggleProject={toggleProject} onClearProjects={clearProjects}
                onSetPeriod={setPeriod} />
            : <Loading />
      )}
      {toast && <div className="toast">{toast}</div>}
    </Shell>
  )
}

function Loading() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">◌</div>
      <div className="empty-state-title">Carregando…</div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
//  IMPORT PANEL
// ──────────────────────────────────────────────────────────
function ImportPanel({ showToast, onSaved }: { showToast: (m: string) => void; onSaved: (y: number, m: number) => void }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [mode, setMode] = useState<'month' | 'day'>('month')
  const [day, setDay] = useState(today.getDate())
  const [drag, setDrag] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<ParseResponse | null>(null)
  const [pendingMap, setPendingMap] = useState<Record<string, number>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const dim = daysInMonthOf(year, month)

  const handleFile = async (f?: File | null) => {
    if (!f) return
    setParsing(true)
    const fd = new FormData()
    fd.append('file', f)
    fd.append('year', String(year))
    fd.append('month', String(month))
    if (mode === 'day') fd.append('day', String(day))
    const r = await fetch('/api/personnel/parse', { method: 'POST', body: fd })
    const d = await r.json()
    setParsing(false)
    if (!r.ok) { showToast(`Erro: ${d.error}`); return }
    setPreview(d)
    setPendingMap({})
  }

  const allMapped = useMemo(() => {
    if (!preview) return false
    return preview.pendingAliases.every(a => pendingMap[a] != null)
  }, [preview, pendingMap])

  const save = async () => {
    if (!preview) return
    const combined = { ...preview.existingMappings, ...pendingMap }
    setSaving(true)
    const r = await fetch('/api/personnel/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: preview.year, month: preview.month, day: preview.day,
        workers: preview.workers,
        aliasMappings: combined,
      }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { showToast(`Erro: ${d.error}`); return }
    const scope = preview.day != null ? `dia ${preview.day}/${preview.month}` : `${MONTH_NAMES[preview.month]}/${preview.year}`
    showToast(`✓ ${scope}: ${d.workersUpserted} colaboradores · ${d.allocationsInserted} alocações`)
    setPreview(null)
    onSaved(preview.year, preview.month)
  }

  if (!preview) {
    return (
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-eyebrow">Upload</div>
            <div className="card-title">Importar relação de pessoal (XLSX)</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.6, marginBottom: 20 }}>
          Selecione o <b>mês/ano</b> da planilha e suba o arquivo. O sistema lê uma linha por
          colaborador (col A = nome, col B = função, col C–AG = dias). Cada célula vira uma
          alocação diária.
          {' '}Use <b>Dia específico</b> pra subir apenas a coluna de um dia (atualização diária)
          ou <b>Mês inteiro</b> pra sobrescrever tudo do mês.
        </p>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Mês *</label>
            <select className="form-select" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 180 }}>
              {MONTH_NAMES.slice(1).map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Ano *</label>
            <select className="form-select" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 110 }}>
              {[year-2, year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Escopo da importação *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button"
                className={mode === 'month' ? 'btn btn-primary' : 'btn'}
                onClick={() => setMode('month')}>
                Mês inteiro
              </button>
              <button type="button"
                className={mode === 'day' ? 'btn btn-primary' : 'btn'}
                onClick={() => setMode('day')}>
                Dia específico
              </button>
            </div>
          </div>
          {mode === 'day' && (
            <div>
              <label className="form-label">Dia *</label>
              <select className="form-select" value={day} onChange={e => setDay(Number(e.target.value))} style={{ width: 90 }}>
                {Array.from({ length: dim }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{
          marginBottom: 20, padding: '10px 14px', background: mode === 'day' ? '#fff8e1' : '#f4f7fb',
          borderLeft: `3px solid ${mode === 'day' ? C.gold : C.navy}`,
          fontSize: 12, color: C.textSoft, lineHeight: 1.5,
        }}>
          {mode === 'month'
            ? <>📅 <b>Substituição completa</b> — todas as alocações de {MONTH_NAMES[month]}/{year} serão apagadas e regravadas pela planilha.</>
            : <>📆 <b>Atualização diária</b> — apenas as alocações do dia {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year} serão tocadas. Os outros dias do mês ficam intactos.</>}
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
          style={{
            border: `2px dashed ${drag ? C.yellow : C.line}`,
            borderRadius: 4, padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
            background: drag ? 'rgba(245, 197, 24, 0.05)' : '#fafbfc',
            transition: 'all 200ms ease',
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                 onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
          <div style={{ fontSize: 40, marginBottom: 8, color: C.navy }}>{parsing ? '◌' : '⬆'}</div>
          <div style={{ fontFamily: 'var(--font-serif), serif', fontSize: 18, color: C.navy, marginBottom: 6 }}>
            {parsing ? 'Lendo planilha…' : 'Clique ou arraste o arquivo .XLSX'}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            Layout: COLABORADOR | FUNÇÃO | 1 | 2 | … | 31
          </div>
        </div>
      </div>
    )
  }

  // Preview + mapeamento de aliases pendentes
  return (
    <div className="card mb-6">
      <div className="card-header">
        <div>
          <div className="card-eyebrow">
            Prévia · {preview.day != null
              ? `Dia ${String(preview.day).padStart(2, '0')}/${String(preview.month).padStart(2, '0')}/${preview.year}`
              : `${MONTH_NAMES[preview.month]}/${preview.year}`}
          </div>
          <div className="card-title">
            {preview.summary.workerCount} colaboradores · {preview.uniqueAliases.length} obra(s) detectada(s)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setPreview(null)}>Descartar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !allMapped}>
            {saving ? 'Salvando…' : allMapped ? `Autorizar e salvar (${preview.summary.workerCount} colab.)` : `Mapeie ${preview.pendingAliases.length} obra(s) primeiro`}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiInline label="Colaboradores" value={String(preview.summary.workerCount)} color={C.navy} />
        <KpiInline label="Dias-homem (presenças)" value={String(preview.summary.totalPresent)} color={C.green} />
        <KpiInline label="Faltas" value={String(preview.summary.totalAbsent)} color={C.red} />
        <KpiInline label="Desligamentos" value={String(preview.summary.totalTerminated)} color={C.terminatedBg} />
      </div>

      {/* Mapeamento de aliases */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-serif), serif', fontSize: 16, color: C.navy, marginBottom: 4 }}>
          Mapeamento de obras
        </h3>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
          Cada nome de obra encontrado na planilha precisa estar vinculado a uma <b>obra cadastrada</b>.
          Mapeamentos salvos aparecem auto-vinculados nas próximas importações.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome na planilha</th>
                <th>Obra cadastrada</th>
                <th style={{ width: 100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.uniqueAliases.map(alias => {
                const isPending = preview.pendingAliases.includes(alias)
                const currentId = isPending ? pendingMap[alias] : preview.existingMappings[alias]
                return (
                  <tr key={alias} style={{ background: isPending && !currentId ? '#fff8e1' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{alias}</td>
                    <td>
                      {isPending ? (
                        <select className="form-select" style={{ maxWidth: 420 }}
                                value={pendingMap[alias] || ''}
                                onChange={e => setPendingMap({ ...pendingMap, [alias]: Number(e.target.value) })}>
                          <option value="">— Selecione a obra —</option>
                          {preview.activeProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 13, color: C.textSoft }}>
                          {preview.activeProjects.find(p => p.id === currentId)?.name || `Obra #${currentId}`}
                        </span>
                      )}
                    </td>
                    <td>
                      {isPending
                        ? (pendingMap[alias]
                            ? <span style={{ color: C.green, fontSize: 12, fontWeight: 600 }}>✓ Novo</span>
                            : <span style={{ color: C.amber, fontSize: 12, fontWeight: 600 }}>Pendente</span>)
                        : <span style={{ color: C.textMuted, fontSize: 12 }}>Já mapeado</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview de colaboradores */}
      <h3 style={{ fontFamily: 'var(--font-serif), serif', fontSize: 16, color: C.navy, marginBottom: 4 }}>
        Colaboradores ({preview.workers.length})
      </h3>
      <div className="table-wrap" style={{ maxHeight: '40vh' }}>
        <table>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              <th>Nome</th>
              <th>Função</th>
              <th style={{ textAlign: 'right' }}>Presenças</th>
              <th style={{ textAlign: 'right' }}>Faltas</th>
            </tr>
          </thead>
          <tbody>
            {preview.workers.slice(0, 200).map(w => {
              const present = w.allocations.filter(a => a.status === 'PRESENT').length
              const absent = w.allocations.filter(a => a.status === 'ABSENCE_JUSTIFIED' || a.status === 'ABSENCE_UNJUSTIFIED').length
              return (
                <tr key={w.name}>
                  <td style={{ fontSize: 13 }}>{w.name}</td>
                  <td style={{ fontSize: 11, color: C.textMuted }}>{w.role || '—'}</td>
                  <td style={{ textAlign: 'right', color: C.green, fontWeight: 600 }}>{present}</td>
                  <td style={{ textAlign: 'right', color: absent > 0 ? C.red : C.textMuted, fontWeight: absent > 0 ? 600 : 400 }}>{absent}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
//  VIEW PANEL
// ──────────────────────────────────────────────────────────
type Granularity = 'month' | 'week' | 'day'

function ViewPanel({
  series, selectedProjectIds, onToggleProject, onClearProjects, onSetPeriod,
}: {
  series: SeriesResponse
  selectedProjectIds: Set<number>
  onToggleProject: (id: number) => void
  onClearProjects: () => void
  onSetPeriod: (year: number, month: number) => void
}) {
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [weekIndex, setWeekIndex] = useState(0)            // 0..N-1 (W1, W2, …)
  const [dayIndex, setDayIndex] = useState(1)              // 1..dim

  if (series.availablePeriods.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">Nenhuma alocação importada ainda</div>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 12, maxWidth: 520, marginInline: 'auto' }}>
            Use a aba <b>Importar</b> pra subir a relação mensal de pessoal de obra do RH.
          </p>
        </div>
      </div>
    )
  }

  const dim = series.daysInMonth
  const totalWeeks = Math.max(1, Math.ceil(dim / 7))

  // Lista de dias visíveis conforme granularidade selecionada
  const visibleDays = useMemo(() => {
    if (granularity === 'day') {
      const d = Math.min(Math.max(dayIndex, 1), dim)
      return [d]
    }
    if (granularity === 'week') {
      const wi = Math.min(Math.max(weekIndex, 0), totalWeeks - 1)
      const start = wi * 7 + 1
      const end = Math.min(start + 6, dim)
      return Array.from({ length: end - start + 1 }, (_, i) => start + i)
    }
    return Array.from({ length: dim }, (_, i) => i + 1)
  }, [granularity, weekIndex, dayIndex, dim, totalWeeks])

  const visibleDaysSet = useMemo(() => new Set(visibleDays), [visibleDays])

  // Allocations filtradas pelo range
  const effectiveAllocations = useMemo(() => {
    return series.allocations.filter(a => visibleDaysSet.has(a.day))
  }, [series.allocations, visibleDaysSet])

  // Mapa projectId → cor
  const projectColors = useMemo(() => {
    const m: Record<number, string> = {}
    series.projects.forEach((p, i) => { m[p.id] = PROJECT_COLORS[i % PROJECT_COLORS.length] })
    return m
  }, [series.projects])

  // Workers visíveis: filtro de obra + filtro de range
  const visibleWorkers = useMemo(() => {
    if (selectedProjectIds.size === 0) {
      // Granularidade mais estreita que mês: só mostra quem tem alocação no range
      if (granularity === 'month') return series.workers
      const ids = new Set<number>()
      effectiveAllocations.forEach(a => { ids.add(a.workerId) })
      return series.workers.filter(w => ids.has(w.id))
    }
    const ids = new Set<number>()
    effectiveAllocations.forEach(a => {
      if (a.projectId != null && selectedProjectIds.has(a.projectId)) ids.add(a.workerId)
    })
    return series.workers.filter(w => ids.has(w.id))
  }, [series.workers, effectiveAllocations, selectedProjectIds, granularity])

  // Allocs indexed: [workerId][day] → AllocRow (índice completo, filtragem visual fica no Heatmap)
  const allocIndex = useMemo(() => {
    const idx: Record<number, Record<number, AllocRow>> = {}
    series.allocations.forEach(a => {
      if (!idx[a.workerId]) idx[a.workerId] = {}
      idx[a.workerId][a.day] = a
    })
    return idx
  }, [series.allocations])

  // Summary recalculado em cima das allocations efetivas
  const effectiveSummary = useMemo(() => {
    let presentDays = 0, absenceJustified = 0, absenceUnjustified = 0, terminated = 0, dayOff = 0, weekend = 0
    for (const a of effectiveAllocations) {
      if (a.status === 'PRESENT') presentDays++
      else if (a.status === 'ABSENCE_JUSTIFIED') absenceJustified++
      else if (a.status === 'ABSENCE_UNJUSTIFIED') absenceUnjustified++
      else if (a.status === 'TERMINATED') terminated++
      else if (a.status === 'DAY_OFF') dayOff++
      else if (a.status === 'WEEKEND') weekend++
    }
    return { presentDays, absenceJustified, absenceUnjustified, terminated, dayOff, weekend }
  }, [effectiveAllocations])

  const totalUtilDias = (effectiveSummary.presentDays + effectiveSummary.absenceJustified + effectiveSummary.absenceUnjustified) || 1
  const presenceRate = effectiveSummary.presentDays / totalUtilDias

  // Distribuição por função (top funções) — restrita aos workers visíveis
  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    visibleWorkers.forEach(w => {
      const role = w.role || 'Sem função'
      counts[role] = (counts[role] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [visibleWorkers])

  // Top faltas por colaborador (no range filtrado)
  const topAbsences = useMemo(() => {
    return visibleWorkers.map(w => {
      const days = effectiveAllocations.filter(a => a.workerId === w.id)
      const justif = days.filter(a => a.status === 'ABSENCE_JUSTIFIED').length
      const naoJustif = days.filter(a => a.status === 'ABSENCE_UNJUSTIFIED').length
      return { name: w.name, justif, naoJustif, total: justif + naoJustif }
    })
      .filter(w => w.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [visibleWorkers, effectiveAllocations])

  // Dias-homem por obra (no range filtrado)
  const daysByProject = useMemo(() => {
    const counts: Record<number, number> = {}
    effectiveAllocations.forEach(a => {
      if (a.status === 'PRESENT' && a.projectId != null) {
        counts[a.projectId] = (counts[a.projectId] || 0) + 1
      }
    })
    return Object.entries(counts).map(([pid, days]) => {
      const p = series.projects.find(pp => pp.id === Number(pid))
      return {
        projectId: Number(pid),
        code: p?.code || String(pid),
        name: p?.name || `#${pid}`,
        shortName: p ? cleanProjectName(p.name) : `#${pid}`,
        days,
        fill: projectColors[Number(pid)] || C.navy,
      }
    }).sort((a, b) => b.days - a.days)
  }, [effectiveAllocations, series.projects, projectColors])

  // Label do range (pra título do heatmap)
  const rangeLabel = useMemo(() => {
    const monthLabel = `${MONTH_NAMES[series.month!]}/${series.year}`
    if (granularity === 'month') return monthLabel
    if (granularity === 'day') {
      const d = String(dayIndex).padStart(2, '0')
      const m = String(series.month!).padStart(2, '0')
      return `Dia ${d}/${m}/${series.year}`
    }
    const start = weekIndex * 7 + 1
    const end = Math.min(start + 6, dim)
    const m = String(series.month!).padStart(2, '0')
    return `Semana ${weekIndex + 1} (${String(start).padStart(2, '0')}–${String(end).padStart(2, '0')}/${m}/${series.year})`
  }, [granularity, weekIndex, dayIndex, dim, series.month, series.year])

  const subUnit = granularity === 'day' ? 'no dia' : granularity === 'week' ? 'na semana' : 'no mês'

  return (
    <>
      {/* Período + granularidade + filtros de obra */}
      <div className="card mb-6">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="card-eyebrow" style={{ marginBottom: 8 }}>Período</div>
            <select className="form-select" style={{ width: 200 }}
                    value={`${series.year}-${series.month}`}
                    onChange={e => {
                      const [y, m] = e.target.value.split('-').map(Number)
                      onSetPeriod(y, m)
                    }}>
              {series.availablePeriods.map(p => (
                <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                  {MONTH_NAMES[p.month]} / {p.year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="card-eyebrow" style={{ marginBottom: 8 }}>Granularidade</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['month', 'week', 'day'] as Granularity[]).map(g => (
                <button key={g}
                  className={granularity === g ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                  onClick={() => setGranularity(g)}>
                  {g === 'month' ? 'Mês' : g === 'week' ? 'Semana' : 'Dia'}
                </button>
              ))}
            </div>
          </div>

          {granularity === 'week' && (
            <div>
              <div className="card-eyebrow" style={{ marginBottom: 8 }}>Semana</div>
              <select className="form-select" style={{ width: 200 }}
                      value={weekIndex}
                      onChange={e => setWeekIndex(Number(e.target.value))}>
                {Array.from({ length: totalWeeks }, (_, i) => {
                  const start = i * 7 + 1
                  const end = Math.min(start + 6, dim)
                  return (
                    <option key={i} value={i}>
                      Semana {i + 1} ({String(start).padStart(2, '0')}–{String(end).padStart(2, '0')})
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {granularity === 'day' && (
            <div>
              <div className="card-eyebrow" style={{ marginBottom: 8 }}>Dia</div>
              <select className="form-select" style={{ width: 100 }}
                      value={dayIndex}
                      onChange={e => setDayIndex(Number(e.target.value))}>
                {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                  const wd = new Date(Date.UTC(series.year!, series.month! - 1, d)).getUTCDay()
                  const wdName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][wd]
                  return <option key={d} value={d}>{String(d).padStart(2, '0')} · {wdName}</option>
                })}
              </select>
            </div>
          )}

          <div style={{ flex: 1, minWidth: 320 }}>
            <div className="card-eyebrow" style={{ marginBottom: 8 }}>Obras</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                className={selectedProjectIds.size === 0 ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                onClick={onClearProjects}
              >
                Consolidado (todas)
              </button>
              {series.projects.map(p => {
                const active = selectedProjectIds.has(p.id)
                const color = projectColors[p.id]
                return (
                  <button
                    key={p.id}
                    onClick={() => onToggleProject(p.id)}
                    className="btn btn-sm"
                    style={{
                      background: active ? color : '#fff',
                      color: active ? '#fff' : C.navy,
                      borderColor: color,
                      fontWeight: active ? 600 : 500,
                    }}
                    title={p.name}
                  >
                    <span style={{ display: 'inline-block', width: 8, height: 8, background: color, marginRight: 6, borderRadius: 1 }} />
                    {cleanProjectName(p.name)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4 mb-6" style={{ gap: 18 }}>
        <KpiBig label="Colaboradores" value={String(visibleWorkers.length)} sub={`${series.summary.workerCount} total no mês`} color={C.navy} />
        <KpiBig label="Dias-homem trabalhados" value={String(effectiveSummary.presentDays)} sub={`presenças efetivas ${subUnit}`} color={C.green} />
        <KpiBig label="Taxa de presença" value={fmtPct(presenceRate)} sub="presença ÷ dias úteis registrados" color={presenceRate > 0.9 ? C.green : presenceRate > 0.75 ? C.amber : C.red} />
        <KpiBig label={`Faltas ${subUnit}`} value={String(effectiveSummary.absenceJustified + effectiveSummary.absenceUnjustified)}
                sub={`${effectiveSummary.absenceJustified} justif. · ${effectiveSummary.absenceUnjustified} não justif.`}
                color={effectiveSummary.absenceUnjustified > effectiveSummary.absenceJustified ? C.red : C.amber} />
      </div>

      {/* HEATMAP — peça central */}
      <div className="card mb-6 card-accent-yellow">
        <div className="card-header">
          <div>
            <div className="card-eyebrow">Visualização principal</div>
            <div className="card-title">Heatmap de Alocação — {rangeLabel}</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
          Cada linha é um colaborador, cada coluna um dia. Cor da célula = obra alocada.
          Vermelho = falta não justificada, laranja = falta justificada, preto = desligado, cinza = fim de semana/folga.
          Passe o mouse pra detalhes.
        </p>
        <Heatmap
          workers={visibleWorkers}
          allocIndex={allocIndex}
          days={visibleDays}
          year={series.year!}
          month={series.month!}
          projects={series.projects}
          projectColors={projectColors}
        />
      </div>

      <div className="grid-2 mb-6">
        {/* Dias-homem por obra */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-eyebrow">Volume por obra</div>
              <div className="card-title">Dias-homem trabalhados</div>
            </div>
          </div>
          {daysByProject.length === 0 ? (
            <EmptyMini msg="Sem presenças no período" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, daysByProject.length * 36 + 40)}>
              <BarChart data={daysByProject} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.textSoft }} stroke={C.line} />
                <YAxis type="category" dataKey="shortName" tick={{ fontSize: 11, fill: C.textSoft }}
                       width={160} stroke={C.line} />
                <Tooltip
                  formatter={(v: number) => `${v} dias-homem`}
                  contentStyle={{ background: C.navy, border: 'none', borderRadius: 4, fontSize: 12, padding: '10px 14px' }}
                  labelStyle={{ color: C.yellow, fontWeight: 600, marginBottom: 6, fontSize: 11 }}
                  itemStyle={{ color: '#fff', padding: 0 }}
                />
                <Bar dataKey="days" radius={[0, 3, 3, 0]}>
                  {daysByProject.map(d => <Cell key={d.projectId} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribuição por função */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-eyebrow">Composição da equipe</div>
              <div className="card-title">Distribuição por função</div>
            </div>
          </div>
          {roleDistribution.length === 0 ? (
            <EmptyMini msg="Sem colaboradores no filtro" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, roleDistribution.length * 24 + 40)}>
              <BarChart data={roleDistribution} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.textSoft }} stroke={C.line} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.textSoft }}
                       width={200} stroke={C.line}
                       tickFormatter={v => v.length > 28 ? v.slice(0, 26) + '…' : v} />
                <Tooltip
                  formatter={(v: number) => `${v} pessoa${v !== 1 ? 's' : ''}`}
                  contentStyle={{ background: C.navy, border: 'none', borderRadius: 4, fontSize: 12, padding: '10px 14px' }}
                  labelStyle={{ color: C.yellow, fontWeight: 600, marginBottom: 6, fontSize: 11 }}
                  itemStyle={{ color: '#fff', padding: 0 }}
                />
                <Bar dataKey="count" fill={C.gold} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid-2 mb-6">
        {/* Status distribution */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-eyebrow">Status agregado</div>
              <div className="card-title">Distribuição de dias por tipo</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Trabalhou', value: effectiveSummary.presentDays, color: C.green },
                  { name: 'Falta justif.', value: effectiveSummary.absenceJustified, color: C.amber },
                  { name: 'Falta não justif.', value: effectiveSummary.absenceUnjustified, color: C.red },
                  { name: 'Desligado', value: effectiveSummary.terminated, color: C.terminatedBg },
                  { name: 'Folga / fim de semana', value: effectiveSummary.dayOff + effectiveSummary.weekend, color: C.dayOffBg },
                ].filter(d => d.value > 0)}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label={(d: { name: string; value: number; percent: number }) => `${d.name}: ${(d.percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {[C.green, C.amber, C.red, C.terminatedBg, C.dayOffBg].map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} dias`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top faltas */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-eyebrow">Pontos de atenção</div>
              <div className="card-title">Top 10 — colaboradores com mais faltas</div>
            </div>
          </div>
          {topAbsences.length === 0 ? (
            <EmptyMini msg="Nenhuma falta registrada 🎉" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, topAbsences.length * 30 + 40)}>
              <BarChart data={topAbsences} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.textSoft }} stroke={C.line} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.textSoft }}
                       width={180} stroke={C.line}
                       tickFormatter={v => v.length > 24 ? v.slice(0, 22) + '…' : v} />
                <Tooltip
                  formatter={(v: number, name: string) => [`${v} dias`, name === 'justif' ? 'Justificadas' : 'Não justificadas']}
                  contentStyle={{ background: C.navy, border: 'none', borderRadius: 4, fontSize: 12, padding: '10px 14px' }}
                  labelStyle={{ color: C.yellow, fontWeight: 600, marginBottom: 6, fontSize: 11 }}
                  itemStyle={{ color: '#fff', padding: 0 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="justif" name="Justificadas" fill={C.amber} stackId="a" />
                <Bar dataKey="naoJustif" name="Não justificadas" fill={C.red} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────
//  HEATMAP
// ──────────────────────────────────────────────────────────
function Heatmap({
  workers, allocIndex, days, year, month, projects, projectColors,
}: {
  workers: WorkerRow[]
  allocIndex: Record<number, Record<number, AllocRow>>
  days: number[]
  year: number; month: number
  projects: Project[]
  projectColors: Record<number, string>
}) {
  // Quanto menos dias, mais larga a célula pra preencher melhor a área
  const cellW = days.length <= 1 ? 80 : days.length <= 7 ? 48 : 22
  const cellH = 22, nameW = 220

  const projectById: Record<number, Project> = {}
  projects.forEach(p => { projectById[p.id] = p })

  const cellInfo = (a: AllocRow | undefined): { bg: string; fg: string; label: string } => {
    if (!a) return { bg: C.weekendBg, fg: C.textMuted, label: '—' }
    switch (a.status) {
      case 'PRESENT':
        return { bg: a.projectId != null ? (projectColors[a.projectId] || C.navy) : C.navy, fg: '#fff', label: a.rawValue || '' }
      case 'ABSENCE_JUSTIFIED':
        return { bg: C.amber, fg: '#fff', label: 'Falta justif.' }
      case 'ABSENCE_UNJUSTIFIED':
        return { bg: C.red, fg: '#fff', label: 'Falta não justif.' }
      case 'TERMINATED':
        return { bg: C.terminatedBg, fg: '#fff', label: 'Desligado' }
      case 'WEEKEND':
        return { bg: C.weekendBg, fg: C.textMuted, label: 'Fim de semana' }
      case 'DAY_OFF':
        return { bg: C.dayOffBg, fg: C.textMuted, label: 'Folga' }
    }
    return { bg: C.line, fg: C.textMuted, label: '?' }
  }

  if (workers.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 16px' }}>
        <div className="empty-state-icon">◇</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>Nenhum colaborador no filtro</div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: `1px solid ${C.line}`, borderRadius: 4 }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{
              position: 'sticky', left: 0, top: 0, zIndex: 3, background: C.navy, color: '#fff',
              padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 10,
              letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: nameW,
            }}>
              Colaborador / Função
            </th>
            {days.map(d => {
              const wd = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
              const isWeekend = wd === 0 || wd === 6
              return (
                <th key={d} style={{
                  position: 'sticky', top: 0, zIndex: 2, background: C.navy, color: isWeekend ? C.yellow : '#fff',
                  padding: '4px 0', width: cellW, minWidth: cellW, textAlign: 'center',
                  fontWeight: 600, fontSize: 10, borderLeft: `1px solid ${C.navyMid}`,
                }}>
                  <div style={{ opacity: 0.6, fontSize: 8, lineHeight: 1 }}>{WEEKDAY_LETTER[wd]}</div>
                  <div>{d}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {workers.map((w, wi) => (
            <tr key={w.id}>
              <td style={{
                position: 'sticky', left: 0, zIndex: 1, background: wi % 2 === 0 ? '#fff' : '#f7f9fc',
                padding: '6px 10px', borderRight: `1px solid ${C.line}`, minWidth: nameW,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, lineHeight: 1.2 }}>
                  {w.name}
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: '0.02em' }}>
                  {w.role || '—'}
                </div>
              </td>
              {days.map(d => {
                const a = allocIndex[w.id]?.[d]
                const { bg, fg, label } = cellInfo(a)
                const projectName = a?.projectId != null ? projectById[a.projectId]?.name : ''
                const title = `${w.name} · Dia ${d}\n${label}${projectName ? ` (${projectName})` : ''}`
                return (
                  <td key={d} title={title}
                      style={{
                        background: bg, color: fg, textAlign: 'center',
                        width: cellW, height: cellH, padding: 0,
                        borderLeft: `1px solid #fff`, borderTop: `1px solid #fff`,
                        cursor: 'default', fontSize: 9, fontWeight: 600,
                      }}>
                    {a?.status === 'ABSENCE_UNJUSTIFIED' && '✕'}
                    {a?.status === 'ABSENCE_JUSTIFIED' && '◐'}
                    {a?.status === 'TERMINATED' && '◼'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────────────────
function cleanProjectName(name: string): string {
  // "02.201.0097 - BUTANTAN - SPCI E SPDA" → "BUTANTAN - SPCI E SPDA"
  return name.replace(/^\d{2}\.\d{3}\.\d{4}\s*-\s*/, '')
}

function KpiInline({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                    fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif), serif', fontSize: 22, color, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function KpiBig({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 16, background: '#fff', padding: '18px 20px', border: `1px solid ${C.line}`, borderLeftWidth: 3 }}>
      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif), serif', fontSize: 26, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function EmptyMini({ msg }: { msg: string }) {
  return (
    <div className="empty-state" style={{ padding: '32px 16px' }}>
      <div className="empty-state-icon">◇</div>
      <div style={{ fontSize: 13, color: C.textMuted }}>{msg}</div>
    </div>
  )
}
