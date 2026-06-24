'use client'
import { useEffect, useRef, useState } from 'react'
import Shell from '@/components/Shell'

type ProjectRow = {
  id: number
  code: string
  name: string
  active: boolean
  aliases: { id: number; alias: string }[]
  _count: { allocations: number }
}

const C = {
  navy: '#0a2540', gold: '#d4a017', yellow: '#f5c518', line: '#e3e7ed',
  textSoft: '#4a5670', textMuted: '#7a869a',
  green: '#197a4a', red: '#b03022',
}

export default function ObrasPage() {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000) }

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/projects').then(x => x.json())
    setRows(r)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleFile = async (f?: File | null) => {
    if (!f) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', f)
    const r = await fetch('/api/projects/upload', { method: 'POST', body: fd })
    const d = await r.json()
    setUploading(false)
    if (!r.ok) { showToast(`Erro: ${d.error}`); return }
    showToast(`✓ ${d.created} novas · ${d.updated} atualizadas · ${d.unchanged} inalteradas`)
    load()
  }

  const toggleActive = async (id: number, active: boolean) => {
    const r = await fetch(`/api/projects/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    if (r.ok) load()
  }

  const active = rows.filter(r => r.active)
  const inactive = rows.filter(r => !r.active)

  return (
    <Shell>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Módulo · Cadastro</div>
          <h1 className="page-title">Obras Ativas</h1>
          <p className="page-subtitle">
            Cadastro das obras em andamento. Sobe a planilha "Obras Ativas ECF" do seu ERP
            e o sistema mantém o cadastro atualizado por código. Obras encerradas ficam aqui
            como inativas até serem reativadas.
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-eyebrow">Upload</div>
            <div className="card-title">Importar planilha de obras (XLSX)</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.6, marginBottom: 18 }}>
          Esperado: 2 colunas — <b>Empreendimento</b> (código) e <b>Empreendimento Descrição</b>.
          O sistema faz upsert por código (cria as novas, atualiza nome de existentes, reativa as
          que tinham sido desativadas).
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
            transition: 'all 200ms ease',
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                 onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
          <div style={{ fontSize: 32, marginBottom: 8, color: C.navy }}>{uploading ? '◌' : '⬆'}</div>
          <div style={{ fontFamily: 'var(--font-serif), serif', fontSize: 16, color: C.navy }}>
            {uploading ? 'Processando…' : 'Clique ou arraste o arquivo .XLSX'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="empty-state-icon">◌</div></div>
      ) : (
        <>
          <div className="card mb-6">
            <div className="card-header">
              <div>
                <div className="card-eyebrow">Em andamento</div>
                <div className="card-title">{active.length} obra{active.length !== 1 ? 's' : ''} ativa{active.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            {active.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 16px' }}>
                <div className="empty-state-icon">◇</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>
                  Nenhuma obra cadastrada. Faça upload da planilha pra começar.
                </div>
              </div>
            ) : (
              <ProjectsTable rows={active} onToggle={toggleActive} />
            )}
          </div>

          {inactive.length > 0 && (
            <div className="card mb-6">
              <div className="card-header">
                <div>
                  <div className="card-eyebrow">Inativas</div>
                  <div className="card-title">{inactive.length} obra{inactive.length !== 1 ? 's' : ''} arquivada{inactive.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <ProjectsTable rows={inactive} onToggle={toggleActive} muted />
            </div>
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </Shell>
  )
}

function ProjectsTable({ rows, onToggle, muted }: { rows: ProjectRow[]; onToggle: (id: number, active: boolean) => void; muted?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 80 }}>Código</th>
            <th>Descrição</th>
            <th>Aliases mapeados</th>
            <th style={{ textAlign: 'right' }}>Alocações</th>
            <th style={{ width: 100 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ opacity: muted ? 0.6 : 1 }}>
              <td style={{ fontWeight: 600, color: C.navy }}>{r.code}</td>
              <td style={{ fontSize: 13 }}>{r.name}</td>
              <td style={{ fontSize: 11, color: C.textMuted }}>
                {r.aliases.length === 0
                  ? <span style={{ fontStyle: 'italic' }}>—</span>
                  : r.aliases.map(a => a.alias).join(' · ')}
              </td>
              <td style={{ textAlign: 'right', fontSize: 13, color: C.textSoft }}>{r._count.allocations}</td>
              <td>
                <button className="btn btn-sm" onClick={() => onToggle(r.id, r.active)}>
                  {r.active ? 'Desativar' : 'Reativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
