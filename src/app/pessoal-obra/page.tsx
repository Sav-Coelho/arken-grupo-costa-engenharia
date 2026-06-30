'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Shell from '@/components/Shell'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'

type Tab = 'view' | 'import' | 'compensation'

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
type SnapshotSummary = {
  id: number
  capturedAt: string
  label: string | null
  day: number
  cellCount: number
}
type CompRow = {
  workerId: number
  contractType: string
  monthlySalary: number
  dailyBenefit: number
}
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
  snapshots: SnapshotSummary[]
  compensations: CompRow[]
}

type SnapshotDetail = {
  id: number
  capturedAt: string
  label: string | null
  year: number
  month: number
  day: number
  date: string
  cells: {
    workerId: number; workerName: string; workerRole: string | null
    projectId: number | null; status: string; rawValue: string | null
  }[]
  finalAvailable: boolean
  comparison: {
    presentInSnapshot: number
    presentInFinal: number
    chegaramDepoisIds: number[]
    saiuAposIds: number[]
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
          {([['view', 'Visão Geral'], ['import', 'Importar'], ['compensation', 'Salários & Benefícios']] as [Tab, string][]).map(([k, label]) => (
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
      {tab === 'compensation' && (
        <CompensationPanel showToast={showToast} />
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
type ImportMode = 'month' | 'day-final' | 'day-snapshot'

function ImportPanel({ showToast, onSaved }: { showToast: (m: string) => void; onSaved: (y: number, m: number) => void }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [mode, setMode] = useState<ImportMode>('month')
  const [day, setDay] = useState(today.getDate())
  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [drag, setDrag] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<ParseResponse | null>(null)
  const [previewMode, setPreviewMode] = useState<ImportMode>('month')
  const [previewLabel, setPreviewLabel] = useState<string>('')
  const [pendingMap, setPendingMap] = useState<Record<string, number>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const dim = daysInMonthOf(year, month)
  const isDayMode = mode !== 'month'

  const handleFile = async (f?: File | null) => {
    if (!f) return
    setParsing(true)
    const fd = new FormData()
    fd.append('file', f)
    fd.append('year', String(year))
    fd.append('month', String(month))
    if (isDayMode) fd.append('day', String(day))
    const r = await fetch('/api/personnel/parse', { method: 'POST', body: fd })
    const d = await r.json()
    setParsing(false)
    if (!r.ok) { showToast(`Erro: ${d.error}`); return }
    setPreview(d)
    setPreviewMode(mode)
    setPreviewLabel(snapshotLabel)
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
    const saveMode = previewMode === 'day-snapshot' ? 'snapshot' : 'final'
    const r = await fetch('/api/personnel/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: preview.year, month: preview.month, day: preview.day,
        mode: saveMode,
        snapshotLabel: previewLabel || null,
        workers: preview.workers,
        aliasMappings: combined,
      }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { showToast(`Erro: ${d.error}`); return }
    if (saveMode === 'snapshot') {
      const labelTxt = previewLabel ? ` (${previewLabel})` : ''
      showToast(`✓ Snapshot${labelTxt} do dia ${preview.day}/${preview.month}: ${d.cellsInserted} registros`)
    } else {
      const scope = preview.day != null ? `dia ${preview.day}/${preview.month}` : `${MONTH_NAMES[preview.month]}/${preview.year}`
      showToast(`✓ Fechamento ${scope}: ${d.workersUpserted} colaboradores · ${d.allocationsInserted} alocações`)
    }
    setPreview(null)
    setSnapshotLabel('')
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
          O sistema lê uma linha por colaborador (col A = nome, col B = função, col C–AG = dias).
          {' '}<b>Mês inteiro</b> e <b>Fechamento do dia</b> gravam na base oficial.
          {' '}<b>Snapshot</b> grava em paralelo (uma "fotografia" do estado da obra naquele momento — útil pra
          comparar manhã × fim do dia sem perder a verdade do dia).
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
            <label className="form-label">Tipo do upload *</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button"
                className={mode === 'month' ? 'btn btn-primary' : 'btn'}
                onClick={() => setMode('month')}>
                Mês inteiro
              </button>
              <button type="button"
                className={mode === 'day-final' ? 'btn btn-primary' : 'btn'}
                onClick={() => setMode('day-final')}>
                Fechamento do dia
              </button>
              <button type="button"
                className={mode === 'day-snapshot' ? 'btn btn-primary' : 'btn'}
                onClick={() => setMode('day-snapshot')}>
                Snapshot intermediário
              </button>
            </div>
          </div>
          {isDayMode && (
            <div>
              <label className="form-label">Dia *</label>
              <select className="form-select" value={day} onChange={e => setDay(Number(e.target.value))} style={{ width: 90 }}>
                {Array.from({ length: dim }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          )}
          {mode === 'day-snapshot' && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Marcador (opcional)</label>
              <input className="form-input" value={snapshotLabel}
                     onChange={e => setSnapshotLabel(e.target.value)}
                     placeholder='ex: "9h", "Vistoria sócios", "12h"' />
            </div>
          )}
        </div>

        <div style={{
          marginBottom: 20, padding: '10px 14px',
          background: mode === 'month' ? '#f4f7fb' : mode === 'day-final' ? '#fff8e1' : '#eaf3ec',
          borderLeft: `3px solid ${mode === 'month' ? C.navy : mode === 'day-final' ? C.gold : C.green}`,
          fontSize: 12, color: C.textSoft, lineHeight: 1.5,
        }}>
          {mode === 'month' && <>📅 <b>Substituição completa</b> — todas as alocações de {MONTH_NAMES[month]}/{year} serão apagadas e regravadas pela planilha.</>}
          {mode === 'day-final' && <>📆 <b>Fechamento do dia</b> — apenas as alocações do dia {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year} serão substituídas. Esta é a verdade oficial do dia.</>}
          {mode === 'day-snapshot' && <>📸 <b>Snapshot intermediário</b> — uma fotografia do dia {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year} será criada e arquivada com timestamp. Não toca na verdade oficial do dia. Útil pra registrar "quem estava na obra às 9h".</>}
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
            Prévia · {previewMode === 'day-snapshot' ? '📸 Snapshot' : previewMode === 'day-final' ? '📆 Fechamento' : '📅 Mês inteiro'}
            {' · '}
            {preview.day != null
              ? `${String(preview.day).padStart(2, '0')}/${String(preview.month).padStart(2, '0')}/${preview.year}`
              : `${MONTH_NAMES[preview.month]}/${preview.year}`}
            {previewMode === 'day-snapshot' && previewLabel && <> · "{previewLabel}"</>}
          </div>
          <div className="card-title">
            {preview.summary.workerCount} colaboradores · {preview.uniqueAliases.length} obra(s) detectada(s)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setPreview(null)}>Descartar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !allMapped}>
            {saving
              ? 'Salvando…'
              : !allMapped
                ? `Mapeie ${preview.pendingAliases.length} obra(s) primeiro`
                : previewMode === 'day-snapshot'
                  ? `Salvar snapshot (${preview.summary.workerCount} colab.)`
                  : `Autorizar e salvar (${preview.summary.workerCount} colab.)`}
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
  const [weekIndex, setWeekIndex] = useState(0)
  const [dayIndex, setDayIndex] = useState(1)
  const [snapshotId, setSnapshotId] = useState<number | null>(null)
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotDetail | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // Quando snapshotId muda, faz fetch do detalhe
  useEffect(() => {
    if (snapshotId == null) { setSnapshotDetail(null); return }
    let cancelled = false
    setSnapshotLoading(true)
    fetch(`/api/snapshots/${snapshotId}`)
      .then(r => r.json())
      .then((d: SnapshotDetail) => {
        if (cancelled) return
        setSnapshotDetail(d)
        setSnapshotLoading(false)
        // Força granularidade pra "day" no dia do snapshot
        setGranularity('day')
        setDayIndex(d.day)
      })
      .catch(() => { if (!cancelled) setSnapshotLoading(false) })
    return () => { cancelled = true }
  }, [snapshotId])

  // Reseta snapshot ao mudar de mês
  useEffect(() => { setSnapshotId(null) }, [series.year, series.month])

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

  // Allocations efetivas: do snapshot se selecionado, senão das allocations normais
  const effectiveAllocations = useMemo(() => {
    if (snapshotDetail) {
      // Converte cells do snapshot pro formato AllocRow (todos têm o mesmo day)
      return snapshotDetail.cells.map(c => ({
        workerId: c.workerId,
        date: snapshotDetail.date,
        day: snapshotDetail.day,
        projectId: c.projectId,
        status: c.status,
        rawValue: c.rawValue,
      }))
    }
    return series.allocations.filter(a => visibleDaysSet.has(a.day))
  }, [series.allocations, visibleDaysSet, snapshotDetail])


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

  // Allocs indexed: [workerId][day] → AllocRow
  // Quando snapshot ativo, usa as cells do snapshot. Caso contrário, série completa.
  const allocIndex = useMemo(() => {
    const idx: Record<number, Record<number, AllocRow>> = {}
    const source = snapshotDetail ? effectiveAllocations : series.allocations
    source.forEach(a => {
      if (!idx[a.workerId]) idx[a.workerId] = {}
      idx[a.workerId][a.day] = a
    })
    return idx
  }, [series.allocations, snapshotDetail, effectiveAllocations])

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

  // Mapa workerId → comp (pra cálculo de custo)
  const compByWorker = useMemo(() => {
    const m = new Map<number, CompRow>()
    series.compensations.forEach(c => { m.set(c.workerId, c) })
    return m
  }, [series.compensations])

  // Função pura: custo de um worker em um dia específico, baseado no status
  function dailyCostForAllocation(a: AllocRow): number {
    const c = compByWorker.get(a.workerId)
    if (!c) return 0
    if (a.status === 'TERMINATED') return 0
    const isCelt = c.contractType === 'CELETISTA'
    const isWeekendDay = a.status === 'WEEKEND'
    // Salário CELETISTA cobre todo dia. PF/PJ só em dia útil.
    const salaryPerDay = isCelt ? c.monthlySalary / 30 : c.monthlySalary / 22
    const benefitPerDay = c.dailyBenefit
    if (isCelt) {
      // CELETISTA: salário cobre todo dia; benefício só em dia útil (não WEEKEND)
      return salaryPerDay + (isWeekendDay ? 0 : benefitPerDay)
    }
    // PF/PJ: só em dia útil (WEEKEND não conta)
    return isWeekendDay ? 0 : (salaryPerDay + benefitPerDay)
  }

  // Dias-homem + custo por obra (no range filtrado)
  const daysByProject = useMemo(() => {
    const counts: Record<number, { days: number; cost: number }> = {}
    effectiveAllocations.forEach(a => {
      if (a.status === 'PRESENT' && a.projectId != null) {
        if (!counts[a.projectId]) counts[a.projectId] = { days: 0, cost: 0 }
        counts[a.projectId].days++
        counts[a.projectId].cost += dailyCostForAllocation(a)
      }
    })
    return Object.entries(counts).map(([pid, v]) => {
      const p = series.projects.find(pp => pp.id === Number(pid))
      return {
        projectId: Number(pid),
        code: p?.code || String(pid),
        name: p?.name || `#${pid}`,
        shortName: p ? cleanProjectName(p.name) : `#${pid}`,
        days: v.days,
        cost: v.cost,
        fill: projectColors[Number(pid)] || C.navy,
      }
    }).sort((a, b) => b.cost - a.cost)
  }, [effectiveAllocations, series.projects, projectColors, compByWorker])

  // Custo agregado do período filtrado
  const costSummary = useMemo(() => {
    let totalCost = 0           // todo dia ativo (não TERMINATED)
    let allocatedCost = 0       // PRESENT com projectId
    let unallocatedCost = 0     // PRESENT sem projectId + faltas + folgas
    let workersWithComp = 0
    const seenWorkers = new Set<number>()
    effectiveAllocations.forEach(a => {
      const cost = dailyCostForAllocation(a)
      totalCost += cost
      if (a.status === 'PRESENT' && a.projectId != null) allocatedCost += cost
      else if (cost > 0) unallocatedCost += cost
      if (!seenWorkers.has(a.workerId)) {
        seenWorkers.add(a.workerId)
        if (compByWorker.has(a.workerId)) workersWithComp++
      }
    })
    return { totalCost, allocatedCost, unallocatedCost, workersWithComp, totalWorkers: seenWorkers.size }
  }, [effectiveAllocations, compByWorker])

  // Custo diário (linha do tempo) — 1 ponto por dia visível
  // Cada dia: alocado em obras (verde) + não alocado (cinza)
  const dailyCostSeries = useMemo(() => {
    const byDay: Record<number, { allocated: number; unallocated: number }> = {}
    visibleDays.forEach(d => { byDay[d] = { allocated: 0, unallocated: 0 } })
    effectiveAllocations.forEach(a => {
      const cost = dailyCostForAllocation(a)
      if (cost === 0) return
      if (!byDay[a.day]) byDay[a.day] = { allocated: 0, unallocated: 0 }
      if (a.status === 'PRESENT' && a.projectId != null) byDay[a.day].allocated += cost
      else byDay[a.day].unallocated += cost
    })
    return visibleDays.map(d => {
      const wd = new Date(Date.UTC(series.year!, series.month! - 1, d)).getUTCDay()
      const wdName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][wd]
      return {
        day: d,
        label: `${String(d).padStart(2, '0')}`,
        weekday: wdName,
        allocated: Math.round(byDay[d]?.allocated || 0),
        unallocated: Math.round(byDay[d]?.unallocated || 0),
        total: Math.round((byDay[d]?.allocated || 0) + (byDay[d]?.unallocated || 0)),
      }
    })
  }, [effectiveAllocations, visibleDays, compByWorker, series.year, series.month])

  // Custo por função (no range filtrado, considerando workers visíveis com comp)
  const costByRole = useMemo(() => {
    const byRole: Record<string, number> = {}
    effectiveAllocations.forEach(a => {
      const cost = dailyCostForAllocation(a)
      if (cost === 0) return
      const w = series.workers.find(ww => ww.id === a.workerId)
      const role = w?.role || 'Sem função'
      byRole[role] = (byRole[role] || 0) + cost
    })
    return Object.entries(byRole)
      .map(([name, cost]) => ({ name, cost: Math.round(cost) }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 12)
  }, [effectiveAllocations, compByWorker, series.workers])

  // Top 10 colaboradores por custo
  const topWorkersByCost = useMemo(() => {
    const byWorker: Record<number, number> = {}
    effectiveAllocations.forEach(a => {
      const cost = dailyCostForAllocation(a)
      if (cost === 0) return
      byWorker[a.workerId] = (byWorker[a.workerId] || 0) + cost
    })
    return Object.entries(byWorker)
      .map(([wid, cost]) => {
        const w = series.workers.find(ww => ww.id === Number(wid))
        return {
          workerId: Number(wid),
          name: w?.name || `#${wid}`,
          role: w?.role || '',
          cost: Math.round(cost),
        }
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)
  }, [effectiveAllocations, compByWorker, series.workers])

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
            <div className="card-eyebrow" style={{ marginBottom: 8 }}>Quadro de Funcionários em Horário</div>
            <select className="form-select" style={{ width: 320 }}
                    value={snapshotId ?? ''}
                    onChange={e => setSnapshotId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">📌 Fechamento oficial</option>
              {series.snapshots.map(s => {
                const dt = new Date(s.capturedAt)
                const hh = String(dt.getHours()).padStart(2, '0')
                const mm = String(dt.getMinutes()).padStart(2, '0')
                const labelTxt = s.label ? ` "${s.label}"` : ''
                return (
                  <option key={s.id} value={s.id}>
                    📸 Dia {String(s.day).padStart(2, '0')} · {hh}:{mm}{labelTxt} ({s.cellCount} reg.)
                  </option>
                )
              })}
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

      {/* Banner de snapshot ativo */}
      {snapshotDetail && (
        <div className="card mb-6" style={{ borderTop: `3px solid ${C.amber}`, padding: '18px 24px' }}>
          {(() => {
            const dt = new Date(snapshotDetail.capturedAt)
            const hh = String(dt.getHours()).padStart(2, '0')
            const mm = String(dt.getMinutes()).padStart(2, '0')
            const dd = String(snapshotDetail.day).padStart(2, '0')
            const mo = String(snapshotDetail.month).padStart(2, '0')
            return (
              <>
                <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.amber, fontWeight: 600, marginBottom: 6 }}>
                  📸 Snapshot {snapshotDetail.label ? `"${snapshotDetail.label}"` : 'intermediário'}
                </div>
                <div style={{ fontFamily: 'var(--font-serif), serif', fontSize: 22, color: C.navy, marginBottom: 8 }}>
                  Fotografia do dia {dd}/{mo}/{snapshotDetail.year} às {hh}:{mm}
                </div>
                <p style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5, margin: 0 }}>
                  Você está vendo o estado da obra <b>no momento em que essa foto foi tirada</b>.
                  {snapshotDetail.finalAvailable
                    ? <> A comparação abaixo cruza com o fechamento oficial do dia.</>
                    : <> Ainda não há fechamento oficial registrado pra esse dia.</>}
                </p>
              </>
            )
          })()}
        </div>
      )}

      {/* KPIs — comum aos modos */}
      <div className="grid-4 mb-6" style={{ gap: 18 }}>
        <KpiBig
          label={snapshotDetail ? 'Colaboradores no snapshot' : 'Colaboradores'}
          value={String(visibleWorkers.length)}
          sub={snapshotDetail ? `${snapshotDetail.cells.length} registros lidos` : `${series.summary.workerCount} total no mês`}
          color={C.navy} />
        <KpiBig
          label={snapshotDetail ? 'Presentes no snapshot' : 'Dias-homem trabalhados'}
          value={String(effectiveSummary.presentDays)}
          sub={snapshotDetail
            ? (snapshotDetail.label ? `às ${new Date(snapshotDetail.capturedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : `presentes no momento`)
            : `presenças efetivas ${subUnit}`}
          color={C.green} />
        <KpiBig
          label="Taxa de presença"
          value={fmtPct(presenceRate)}
          sub={snapshotDetail ? 'no momento da foto' : 'presença ÷ dias úteis registrados'}
          color={presenceRate > 0.9 ? C.green : presenceRate > 0.75 ? C.amber : C.red} />
        <KpiBig
          label={snapshotDetail ? 'Faltas no snapshot' : `Faltas ${subUnit}`}
          value={String(effectiveSummary.absenceJustified + effectiveSummary.absenceUnjustified)}
          sub={`${effectiveSummary.absenceJustified} justif. · ${effectiveSummary.absenceUnjustified} não justif.`}
          color={effectiveSummary.absenceUnjustified > effectiveSummary.absenceJustified ? C.red : C.amber} />
      </div>

      {/* KPIs de custo (quando houver pelo menos 1 comp cadastrada) */}
      {series.compensations.length > 0 && (
        <div className="grid-3 mb-6" style={{ gap: 18 }}>
          <KpiBig
            label={`Custo total ${subUnit}`}
            value={costSummary.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            sub={`${costSummary.workersWithComp}/${costSummary.totalWorkers} colab. com salário cadastrado`}
            color={C.navy} />
          <KpiBig
            label="Alocado em obras (PRESENT)"
            value={costSummary.allocatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            sub={costSummary.totalCost > 0
              ? `${((costSummary.allocatedCost / costSummary.totalCost) * 100).toFixed(1)}% do custo total`
              : '—'}
            color={C.green} />
          <KpiBig
            label="Não alocado (faltas, folgas)"
            value={costSummary.unallocatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            sub={costSummary.totalCost > 0
              ? `${((costSummary.unallocatedCost / costSummary.totalCost) * 100).toFixed(1)}% do custo total`
              : '—'}
            color={C.amber} />
        </div>
      )}

      {/* KPI comparativo: chegaram depois / saíram depois */}
      {snapshotDetail && snapshotDetail.finalAvailable && (
        <div className="grid-2 mb-6" style={{ gap: 18 }}>
          <KpiBig
            label="Chegaram depois do snapshot"
            value={String(snapshotDetail.comparison.chegaramDepoisIds.length)}
            sub={snapshotDetail.comparison.chegaramDepoisIds.length === 0
              ? 'todo mundo já estava na obra na foto'
              : `${snapshotDetail.comparison.chegaramDepoisIds.length} pessoa(s) chegou(ram) entre a foto e o fechamento`}
            color={snapshotDetail.comparison.chegaramDepoisIds.length > 0 ? C.red : C.green} />
          <KpiBig
            label="Saíram após o snapshot"
            value={String(snapshotDetail.comparison.saiuAposIds.length)}
            sub={snapshotDetail.comparison.saiuAposIds.length === 0
              ? 'ninguém saiu entre a foto e o fechamento'
              : `${snapshotDetail.comparison.saiuAposIds.length} pessoa(s) estava(m) na foto mas não no fechamento`}
            color={snapshotDetail.comparison.saiuAposIds.length > 0 ? C.amber : C.green} />
        </div>
      )}

      {/* Lista nominal de quem chegou depois / saiu depois */}
      {snapshotDetail && snapshotDetail.finalAvailable && (snapshotDetail.comparison.chegaramDepoisIds.length > 0 || snapshotDetail.comparison.saiuAposIds.length > 0) && (
        <div className="grid-2 mb-6">
          {snapshotDetail.comparison.chegaramDepoisIds.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-eyebrow" style={{ color: C.red }}>Chegaram depois</div>
                  <div className="card-title">Não Estavam Durante Registro</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.textSoft }}>
                {snapshotDetail.comparison.chegaramDepoisIds.map(wid => {
                  const w = series.workers.find(ww => ww.id === wid)
                  return (
                    <div key={wid} style={{ padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
                      <div style={{ fontWeight: 600, color: C.navy }}>{w?.name || `#${wid}`}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{w?.role || '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {snapshotDetail.comparison.saiuAposIds.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-eyebrow" style={{ color: C.amber }}>Saíram após a foto</div>
                  <div className="card-title">Estavam na foto, mas não no fechamento</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.textSoft }}>
                {snapshotDetail.comparison.saiuAposIds.map(wid => {
                  const w = series.workers.find(ww => ww.id === wid)
                  return (
                    <div key={wid} style={{ padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
                      <div style={{ fontWeight: 600, color: C.navy }}>{w?.name || `#${wid}`}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{w?.role || '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
        {/* Custo / dias-homem por obra (pizza) */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-eyebrow">Volume por obra</div>
              <div className="card-title">
                {series.compensations.length > 0 ? 'Custo de pessoal por obra' : 'Dias-homem trabalhados'}
              </div>
            </div>
          </div>
          {daysByProject.length === 0 ? (
            <EmptyMini msg="Sem presenças no período" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(280, daysByProject.length * 22 + 200)}>
                <PieChart>
                  <Pie
                    data={daysByProject}
                    dataKey={series.compensations.length > 0 ? 'cost' : 'days'}
                    nameKey="shortName"
                    cx="50%" cy="45%"
                    outerRadius={100}
                    innerRadius={45}
                    paddingAngle={2}
                    label={(d: { shortName: string; percent: number }) =>
                      d.percent >= 0.05 ? `${d.shortName}: ${(d.percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                  >
                    {daysByProject.map(d => <Cell key={d.projectId} fill={d.fill} />)}
                  </Pie>
                  <Tooltip
                    content={(props) => {
                      const payload = (props as { active?: boolean; payload?: { payload?: { days: number; cost: number; shortName: string; name: string } }[] }).payload
                      const active = (props as { active?: boolean }).active
                      if (!active || !payload || !payload[0]?.payload) return null
                      const p = payload[0].payload
                      return (
                        <div style={{ background: C.navy, padding: '10px 14px', borderRadius: 4, fontSize: 12, maxWidth: 280 }}>
                          <div style={{ color: C.yellow, fontWeight: 600, marginBottom: 6, fontSize: 11 }}>{p.shortName}</div>
                          <div style={{ color: '#fff' }}>Dias-homem: <b>{p.days}</b></div>
                          {series.compensations.length > 0 && <div style={{ color: '#fff' }}>Custo: <b>{p.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>}
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="square"
                    wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                    formatter={(value, entry) => {
                      const p = (entry as { payload?: { cost?: number; days?: number } }).payload
                      const val = series.compensations.length > 0 && p?.cost != null
                        ? p.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                        : `${p?.days || 0} d-h`
                      return <span style={{ color: C.textSoft }}>{value} · <b>{val}</b></span>
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </>
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

      {/* ─── BLOCO DE CUSTO (gráficos) ──────────────────────── */}
      {series.compensations.length > 0 && (
        <>
          {/* Custo diário ao longo do mês */}
          <div className="card mb-6 card-accent-gold">
            <div className="card-header">
              <div>
                <div className="card-eyebrow">Custo · evolução</div>
                <div className="card-title">Custo diário de pessoal — {rangeLabel}</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
              Barras empilhadas: <b style={{ color: C.green }}>verde</b> = custo alocado em obra (PRESENT);
              {' '}<b style={{ color: C.amber }}>laranja</b> = custo "ocioso" (faltas, folgas, fim de semana de celetistas).
            </p>
            {dailyCostSeries.length === 0 ? (
              <EmptyMini msg="Sem custo no período" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyCostSeries} margin={{ top: 8, right: 24, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSoft }} stroke={C.line} />
                  <YAxis tick={{ fontSize: 11, fill: C.textSoft }}
                         tickFormatter={v => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`}
                         stroke={C.line} />
                  <Tooltip
                    content={(props) => {
                      const payload = (props as { active?: boolean; payload?: { payload?: { day: number; weekday: string; allocated: number; unallocated: number; total: number } }[] }).payload
                      const active = (props as { active?: boolean }).active
                      if (!active || !payload || !payload[0]?.payload) return null
                      const p = payload[0].payload
                      return (
                        <div style={{ background: C.navy, padding: '10px 14px', borderRadius: 4, fontSize: 12, minWidth: 200 }}>
                          <div style={{ color: C.yellow, fontWeight: 600, marginBottom: 6, fontSize: 11 }}>
                            Dia {String(p.day).padStart(2, '0')} · {p.weekday}
                          </div>
                          <div style={{ color: C.green }}>Alocado: <b>R$ {p.allocated.toLocaleString('pt-BR')}</b></div>
                          <div style={{ color: C.amber }}>Não alocado: <b>R$ {p.unallocated.toLocaleString('pt-BR')}</b></div>
                          <div style={{ color: '#fff', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                            Total: <b>R$ {p.total.toLocaleString('pt-BR')}</b>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                  <Bar dataKey="allocated" name="Alocado em obra" fill={C.green} stackId="cost" />
                  <Bar dataKey="unallocated" name="Não alocado" fill={C.amber} stackId="cost" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid-2 mb-6">
            {/* Custo por função */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-eyebrow">Custo · composição</div>
                  <div className="card-title">Custo por função</div>
                </div>
              </div>
              {costByRole.length === 0 ? (
                <EmptyMini msg="Sem custo registrado" />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(260, costByRole.length * 30 + 40)}>
                  <BarChart data={costByRole} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.textSoft }} stroke={C.line}
                           tickFormatter={v => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.textSoft }}
                           width={200} stroke={C.line}
                           tickFormatter={v => v.length > 28 ? v.slice(0, 26) + '…' : v} />
                    <Tooltip
                      formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      contentStyle={{ background: C.navy, border: 'none', borderRadius: 4, fontSize: 12, padding: '10px 14px' }}
                      labelStyle={{ color: C.yellow, fontWeight: 600, marginBottom: 6, fontSize: 11 }}
                      itemStyle={{ color: '#fff', padding: 0 }}
                    />
                    <Bar dataKey="cost" fill={C.gold} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top 10 colaboradores por custo */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-eyebrow">Custo · concentração</div>
                  <div className="card-title">Top 10 — maior custo individual</div>
                </div>
              </div>
              {topWorkersByCost.length === 0 ? (
                <EmptyMini msg="Sem custo registrado" />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(260, topWorkersByCost.length * 30 + 40)}>
                  <BarChart data={topWorkersByCost} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.textSoft }} stroke={C.line}
                           tickFormatter={v => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.textSoft }}
                           width={180} stroke={C.line}
                           tickFormatter={v => v.length > 24 ? v.slice(0, 22) + '…' : v} />
                    <Tooltip
                      content={(props) => {
                        const payload = (props as { active?: boolean; payload?: { payload?: { name: string; role: string; cost: number } }[] }).payload
                        const active = (props as { active?: boolean }).active
                        if (!active || !payload || !payload[0]?.payload) return null
                        const p = payload[0].payload
                        return (
                          <div style={{ background: C.navy, padding: '10px 14px', borderRadius: 4, fontSize: 12 }}>
                            <div style={{ color: C.yellow, fontWeight: 600, marginBottom: 4, fontSize: 11 }}>{p.name}</div>
                            {p.role && <div style={{ color: '#fff', opacity: 0.7, marginBottom: 6 }}>{p.role}</div>}
                            <div style={{ color: '#fff' }}>Custo: <b>{p.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="cost" fill={C.navy} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}

      {/* Aviso quando não há comp cadastrada */}
      {series.compensations.length === 0 && (
        <div className="card mb-6" style={{ borderLeft: `3px solid ${C.gold}`, background: '#fff8e1' }}>
          <div style={{ padding: '6px 0' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7a5c00', fontWeight: 600, marginBottom: 6 }}>
              💡 Cadastre os salários
            </div>
            <p style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5, margin: 0 }}>
              Ainda não há salários e benefícios cadastrados. Vá na aba <b>Salários & Benefícios</b> pra subir a planilha
              "Colaboradores Valores.xlsx" — aí os gráficos e KPIs de custo aparecem aqui.
            </p>
          </div>
        </div>
      )}
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
//  COMPENSATION PANEL — Salários & Benefícios
// ──────────────────────────────────────────────────────────
type CompWorkerRow = {
  id: number
  name: string
  role: string | null
  active: boolean
  compensation: {
    id: number
    contractType: string
    monthlySalary: number
    dailyBenefit: number
    benefitPaymentForm: string | null
    updatedAt: string
  } | null
}

type CompParseRow = {
  rawName: string
  role: string | null
  contractType: string
  contractTypeRaw: string | null
  monthlySalary: number
  dailyBenefit: number
  benefitPaymentForm: string | null
  matchedWorkerId: number | null
  matchedWorkerName: string | null
  matchScore: number | null
}

type CompParseResponse = {
  total: number
  matched: number
  rows: CompParseRow[]
  warnings: string[]
  workers: { id: number; name: string; role: string | null }[]
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function dailyCostFor(c: { contractType: string; monthlySalary: number; dailyBenefit: number }) {
  const divisor = c.contractType === 'CELETISTA' ? 30 : 22
  return c.monthlySalary / divisor + c.dailyBenefit
}

function contractLabel(c: string) {
  if (c === 'CELETISTA') return 'Celetista'
  if (c === 'CONTRATO_PF') return 'Contrato PF'
  if (c === 'PJ') return 'PJ'
  return c
}

function CompensationPanel({ showToast }: { showToast: (m: string) => void }) {
  const [rows, setRows] = useState<CompWorkerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<CompParseResponse | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drag, setDrag] = useState(false)
  const [editing, setEditing] = useState<CompWorkerRow | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/compensation').then(x => x.json())
    setRows(r)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleFile = async (f?: File | null) => {
    if (!f) return
    setParsing(true)
    const fd = new FormData()
    fd.append('file', f)
    const r = await fetch('/api/compensation/parse', { method: 'POST', body: fd })
    const d = await r.json()
    setParsing(false)
    if (!r.ok) { showToast(`Erro: ${d.error}`); return }
    setPreview(d)
  }

  const saveAll = async () => {
    if (!preview) return
    setSaving(true)
    const r = await fetch('/api/compensation/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: preview.rows }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { showToast(`Erro: ${d.error}`); return }
    showToast(`✓ ${d.created} criadas · ${d.updated} atualizadas · ${d.skipped} ignoradas (sem worker)`)
    setPreview(null)
    load()
  }

  const setRowMatch = (idx: number, workerId: number | null) => {
    if (!preview) return
    const newRows = [...preview.rows]
    const wk = preview.workers.find(w => w.id === workerId) || null
    newRows[idx] = {
      ...newRows[idx],
      matchedWorkerId: workerId,
      matchedWorkerName: wk?.name ?? null,
      matchScore: workerId ? 1 : null,
    }
    setPreview({ ...preview, rows: newRows, matched: newRows.filter(r => r.matchedWorkerId != null).length })
  }

  // ─── UI ────────────────────────────────────────────────
  if (preview) {
    // Avalia matches duplicados (mais de uma linha apontando pro mesmo worker)
    const counts: Record<number, number> = {}
    preview.rows.forEach(r => { if (r.matchedWorkerId != null) counts[r.matchedWorkerId] = (counts[r.matchedWorkerId] || 0) + 1 })

    return (
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-eyebrow">Prévia · Importação de salários e benefícios</div>
            <div className="card-title">
              {preview.total} linha(s) na planilha · {preview.matched} com worker atribuído · {preview.total - preview.matched} sem
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setPreview(null)}>Descartar</button>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving || preview.matched === 0}>
              {saving ? 'Salvando…' : `Autorizar e salvar (${preview.matched})`}
            </button>
          </div>
        </div>

        {preview.warnings.length > 0 && (
          <details style={{ marginBottom: 16, fontSize: 12, padding: 10, background: '#fff8e1', border: `1px solid ${C.gold}`, borderRadius: 4 }}>
            <summary style={{ cursor: 'pointer', color: '#7a5c00', fontWeight: 600 }}>⚠ {preview.warnings.length} aviso(s) do parser</summary>
            <ul style={{ margin: '8px 0 0 16px', color: C.textSoft }}>
              {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        )}

        <div className="table-wrap" style={{ maxHeight: '60vh' }}>
          <table>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th>Nome (XLSX)</th>
                <th>Contrato</th>
                <th style={{ textAlign: 'right' }}>Salário mês</th>
                <th style={{ textAlign: 'right' }}>Benef./dia</th>
                <th style={{ textAlign: 'right' }}>Custo/dia</th>
                <th>Worker no sistema</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r, idx) => {
                const dup = r.matchedWorkerId != null && counts[r.matchedWorkerId] > 1
                const noMatch = r.matchedWorkerId == null
                const cost = dailyCostFor({ contractType: r.contractType, monthlySalary: r.monthlySalary, dailyBenefit: r.dailyBenefit })
                return (
                  <tr key={idx} style={{ background: noMatch ? '#fcf3f2' : dup ? '#fff8e1' : undefined }}>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>
                      {r.rawName}
                      {r.role && <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 400 }}>{r.role}</div>}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 2,
                        background: r.contractType === 'CELETISTA' ? '#eaf3ec' : '#eef2f9',
                        color: r.contractType === 'CELETISTA' ? C.green : C.navy,
                        fontWeight: 600,
                      }}>{contractLabel(r.contractType)}</span>
                      {r.contractTypeRaw && r.contractType === 'OUTRO' && (
                        <div style={{ fontSize: 10, color: C.amber, marginTop: 2 }}>?? "{r.contractTypeRaw}"</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtBRL(r.monthlySalary)}</td>
                    <td style={{ textAlign: 'right', color: r.dailyBenefit > 0 ? C.textSoft : C.textMuted }}>
                      {r.dailyBenefit > 0 ? fmtBRL(r.dailyBenefit) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: C.navy }}>{fmtBRL(cost)}</td>
                    <td>
                      <select className="form-select" style={{ fontSize: 12, minWidth: 220 }}
                              value={r.matchedWorkerId ?? ''}
                              onChange={e => setRowMatch(idx, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— Ignorar —</option>
                        {preview.workers.map(w => (
                          <option key={w.id} value={w.id}>{w.name}{w.role ? ` (${w.role})` : ''}</option>
                        ))}
                      </select>
                      {r.matchScore != null && r.matchScore < 1 && (
                        <div style={{ fontSize: 10, color: C.amber, marginTop: 2 }}>
                          Match por similaridade ({r.matchScore.toFixed(2)})
                        </div>
                      )}
                      {dup && (
                        <div style={{ fontSize: 10, color: C.red, marginTop: 2, fontWeight: 600 }}>
                          ⚠ worker duplicado
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Sem preview: mostra upload + lista atual
  const totalMonthly = rows.filter(r => r.compensation).reduce((s, r) => s + (r.compensation?.monthlySalary || 0), 0)
  const totalDailyBenefit = rows.filter(r => r.compensation).reduce((s, r) => s + (r.compensation?.dailyBenefit || 0), 0)
  const withComp = rows.filter(r => r.compensation).length
  const withoutComp = rows.filter(r => !r.compensation).length

  return (
    <>
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-eyebrow">Upload</div>
            <div className="card-title">Importar planilha de salários e benefícios (XLSX)</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.6, marginBottom: 18 }}>
          Esperado: 3 abas — <b>Salários</b> (A:nome B:função C:contrato D:remuneração), <b>Benefícios 1ª/2ª Quinzena</b>
          {' '}(A:nome B:dias úteis C:custo unitário diário …). O sistema casa nomes por similaridade
          e mostra prévia editável antes de salvar.
        </p>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
          style={{
            border: `2px dashed ${drag ? C.yellow : C.line}`,
            borderRadius: 4, padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
            background: drag ? 'rgba(245, 197, 24, 0.05)' : '#fafbfc',
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                 onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
          <div style={{ fontSize: 32, marginBottom: 8, color: C.navy }}>{parsing ? '◌' : '⬆'}</div>
          <div style={{ fontFamily: 'var(--font-serif), serif', fontSize: 16, color: C.navy }}>
            {parsing ? 'Processando…' : 'Clique ou arraste o arquivo "Colaboradores Valores.xlsx"'}
          </div>
        </div>
      </div>

      <div className="grid-3 mb-6" style={{ gap: 18 }}>
        <KpiBig label="Colaboradores cadastrados" value={String(withComp)} sub={`${withoutComp} sem cadastro`} color={C.navy} />
        <KpiBig label="Folha mensal estimada" value={fmtBRL(totalMonthly)} sub="soma dos salários cadastrados" color={C.green} />
        <KpiBig label="Benefício diário (soma)" value={fmtBRL(totalDailyBenefit)} sub={`${withComp} colaboradores`} color={C.gold} />
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-eyebrow">Cadastro atual</div>
            <div className="card-title">Colaboradores e custos</div>
          </div>
        </div>
        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">◌</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Função</th>
                  <th>Contrato</th>
                  <th style={{ textAlign: 'right' }}>Salário mês</th>
                  <th style={{ textAlign: 'right' }}>Benef./dia</th>
                  <th style={{ textAlign: 'right' }}>Custo/dia</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const c = r.compensation
                  const cost = c ? dailyCostFor(c) : 0
                  return (
                    <tr key={r.id} style={{ opacity: c ? 1 : 0.55 }}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</td>
                      <td style={{ fontSize: 11, color: C.textMuted }}>{r.role || '—'}</td>
                      <td style={{ fontSize: 11 }}>
                        {c ? (
                          <span style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 2,
                            background: c.contractType === 'CELETISTA' ? '#eaf3ec' : '#eef2f9',
                            color: c.contractType === 'CELETISTA' ? C.green : C.navy,
                            fontWeight: 600,
                          }}>{contractLabel(c.contractType)}</span>
                        ) : <span style={{ color: C.textMuted, fontStyle: 'italic' }}>não cadastrado</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{c ? fmtBRL(c.monthlySalary) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{c && c.dailyBenefit > 0 ? fmtBRL(c.dailyBenefit) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: C.navy }}>{c ? fmtBRL(cost) : '—'}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setEditing(r)}>
                          {c ? 'Editar' : 'Definir'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <CompensationModal
          worker={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { showToast(msg); setEditing(null); load() }}
        />
      )}
    </>
  )
}

function CompensationModal({ worker, onClose, onSaved }: {
  worker: CompWorkerRow
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const c = worker.compensation
  const [contractType, setContractType] = useState(c?.contractType || 'CONTRATO_PF')
  const [monthlySalary, setMonthlySalary] = useState(String(c?.monthlySalary || ''))
  const [dailyBenefit, setDailyBenefit] = useState(String(c?.dailyBenefit || ''))
  const [paymentForm, setPaymentForm] = useState(c?.benefitPaymentForm || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setError(null)
    const r = await fetch('/api/compensation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: worker.id,
        contractType,
        monthlySalary: Number(monthlySalary.replace(',', '.')) || 0,
        dailyBenefit: Number(dailyBenefit.replace(',', '.')) || 0,
        benefitPaymentForm: paymentForm.trim() || null,
      }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { setError(d.error || 'Erro ao salvar'); return }
    onSaved(`✓ ${worker.name} atualizado`)
  }

  const cost = dailyCostFor({
    contractType,
    monthlySalary: Number(monthlySalary.replace(',', '.')) || 0,
    dailyBenefit: Number(dailyBenefit.replace(',', '.')) || 0,
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10, 37, 64, 0.5)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderTop: `3px solid ${C.yellow}`,
        borderRadius: 4, width: '100%', maxWidth: 560, padding: 28,
        boxShadow: '0 20px 40px rgba(10, 37, 64, 0.25)',
      }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>
            Salário e benefício
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif), serif', fontSize: 22, color: C.navy, margin: 0 }}>
            {worker.name}
          </h2>
          {worker.role && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{worker.role}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Tipo de contrato *</label>
          <select className="form-select" value={contractType} onChange={e => setContractType(e.target.value)}>
            <option value="CELETISTA">Celetista (CLT) — salário ÷ 30 dias</option>
            <option value="CONTRATO_PF">Contrato PF — salário ÷ 22 dias úteis</option>
            <option value="PJ">PJ — salário ÷ 22 dias úteis</option>
            <option value="OUTRO">Outro — salário ÷ 22 dias úteis</option>
          </select>
        </div>

        <div className="grid-2" style={{ gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Salário mensal (R$)</label>
            <input className="form-input" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)}
                   placeholder="ex: 4300" inputMode="decimal" />
          </div>
          <div className="form-group">
            <label className="form-label">Benefício diário (R$)</label>
            <input className="form-input" value={dailyBenefit} onChange={e => setDailyBenefit(e.target.value)}
                   placeholder="ex: 53" inputMode="decimal" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Forma de pagamento do benefício (opcional)</label>
          <input className="form-input" value={paymentForm} onChange={e => setPaymentForm(e.target.value)}
                 placeholder="ex: CRÉDITO EM CONTA / RECARGA SWILE" />
        </div>

        <div style={{ padding: '12px 14px', background: '#f4f7fb', borderLeft: `3px solid ${C.navy}`, fontSize: 12, marginBottom: 18 }}>
          <b>Custo/dia calculado:</b> {fmtBRL(cost)}
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            Salário/dia = {fmtBRL((Number(monthlySalary.replace(',', '.')) || 0) / (contractType === 'CELETISTA' ? 30 : 22))}
            {' · '}Benefício/dia = {fmtBRL(Number(dailyBenefit.replace(',', '.')) || 0)}
          </div>
        </div>

        {error && (
          <div style={{ background: '#fcf3f2', border: `1px solid ${C.red}`, color: C.red,
                        padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
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
