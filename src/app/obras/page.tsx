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

type ModalState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; project: ProjectRow }

export default function ObrasPage() {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' })
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

  const toggleActive = async (p: ProjectRow) => {
    const r = await fetch(`/api/projects/${p.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    })
    if (r.ok) load(); else { const d = await r.json(); showToast(`Erro: ${d.error}`) }
  }

  const remove = async (p: ProjectRow) => {
    if (!confirm(`Deletar a obra ${p.code} — ${p.name}?\n\nA exclusão é permanente. Se houver alocações vinculadas, o sistema bloqueia (use "Desativar" pra esconder sem perder histórico).`)) return
    const r = await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
    const d = await r.json()
    if (!r.ok) { showToast(`Erro: ${d.error}`); return }
    showToast(`✓ Obra ${p.code} removida`)
    load()
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
            Cadastro das obras em andamento. Você pode importar a planilha "Obras Ativas ECF"
            do ERP ou cadastrar/editar manualmente. Obras encerradas viram inativas
            (ficam ocultas dos dashboards mas mantêm o histórico).
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ kind: 'create' })}>
          + Nova obra
        </button>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-eyebrow">Upload em lote</div>
            <div className="card-title">Importar planilha de obras (XLSX)</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.6, marginBottom: 18 }}>
          Esperado: 2 colunas — <b>Empreendimento</b> (código) e <b>Empreendimento Descrição</b>.
          O sistema faz upsert por código (cria novas, atualiza nome de existentes, reativa as
          que estavam desativadas).
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
                  Nenhuma obra cadastrada. Faça upload da planilha ou clique em "+ Nova obra".
                </div>
              </div>
            ) : (
              <ProjectsTable rows={active}
                onToggle={toggleActive}
                onEdit={p => setModal({ kind: 'edit', project: p })}
                onDelete={remove} />
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
              <ProjectsTable rows={inactive}
                onToggle={toggleActive}
                onEdit={p => setModal({ kind: 'edit', project: p })}
                onDelete={remove}
                muted />
            </div>
          )}
        </>
      )}

      {modal.kind !== 'closed' && (
        <ProjectModal
          state={modal}
          onClose={() => setModal({ kind: 'closed' })}
          onSaved={(msg) => { showToast(msg); setModal({ kind: 'closed' }); load() }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </Shell>
  )
}

function ProjectsTable({
  rows, onToggle, onEdit, onDelete, muted,
}: {
  rows: ProjectRow[]
  onToggle: (p: ProjectRow) => void
  onEdit: (p: ProjectRow) => void
  onDelete: (p: ProjectRow) => void
  muted?: boolean
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 80 }}>Código</th>
            <th>Descrição</th>
            <th>Aliases mapeados</th>
            <th style={{ textAlign: 'right' }}>Alocações</th>
            <th style={{ width: 220 }}></th>
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
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm" onClick={() => onEdit(r)}>Editar</button>
                  <button className="btn btn-sm" onClick={() => onToggle(r)}>
                    {r.active ? 'Desativar' : 'Reativar'}
                  </button>
                  {r._count.allocations === 0 && (
                    <button className="btn btn-sm btn-danger" onClick={() => onDelete(r)}>Excluir</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProjectModal({
  state, onClose, onSaved,
}: {
  state: { kind: 'create' } | { kind: 'edit'; project: ProjectRow }
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const isEdit = state.kind === 'edit'
  const initial = isEdit ? state.project : { code: '', name: '', active: true }
  const [code, setCode] = useState(initial.code)
  const [name, setName] = useState(initial.name)
  const [active, setActive] = useState(initial.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setError(null)
    const url = isEdit ? `/api/projects/${state.project.id}` : '/api/projects'
    const method = isEdit ? 'PUT' : 'POST'
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim(), name: name.trim(), active }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { setError(d.error || 'Erro ao salvar'); return }
    onSaved(isEdit ? `✓ Obra ${code} atualizada` : `✓ Obra ${code} criada`)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10, 37, 64, 0.5)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderTop: `3px solid ${C.yellow}`,
        borderRadius: 4, width: '100%', maxWidth: 540, padding: 28,
        boxShadow: '0 20px 40px rgba(10, 37, 64, 0.25)',
      }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>
            {isEdit ? 'Editar obra' : 'Nova obra'}
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif), serif', fontSize: 22, color: C.navy, margin: 0 }}>
            {isEdit ? `${state.project.code} · ${state.project.name}` : 'Cadastro manual'}
          </h2>
        </div>

        <div className="form-group">
          <label className="form-label">Código *</label>
          <input className="form-input" value={code} onChange={e => setCode(e.target.value)}
                 placeholder="ex: 5023" autoFocus />
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            Identificador único da obra no ERP (Empreendimento).
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Descrição *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)}
                 placeholder="ex: 02.201.0103 - NOVO CLIENTE - ESCOPO" />
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            Mesmo formato da planilha do ERP. Pode editar livremente.
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            <span>Obra ativa (aparece nos dashboards e nos dropdowns de mapeamento)</span>
          </label>
        </div>

        {error && (
          <div style={{ background: '#fcf3f2', border: `1px solid ${C.red}`, color: C.red,
                        padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !code.trim() || !name.trim()}>
            {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar obra'}
          </button>
        </div>
      </div>
    </div>
  )
}
