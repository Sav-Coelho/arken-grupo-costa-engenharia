import Shell from '@/components/Shell'

export default function Home() {
  return (
    <Shell>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Plataforma</div>
          <h1 className="page-title">Arken · Grupo Costa Engenharia</h1>
          <p className="page-subtitle">
            Sistema de gestão corporativa em construção. Os módulos serão adicionados conforme
            o escopo for definido com o cliente.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">Nenhum módulo ativo</div>
          <p style={{ fontSize: 13, color: 'var(--arken-text-muted)', marginTop: 12, maxWidth: 520, marginInline: 'auto', lineHeight: 1.6 }}>
            A casca da plataforma está pronta. Conforme os módulos forem definidos, eles
            aparecerão no menu lateral.
          </p>
        </div>
      </div>
    </Shell>
  )
}
