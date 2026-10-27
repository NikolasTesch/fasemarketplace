import './settings.css';

const channels = [
  { id: 'shopee', name: 'Shopee', icon: 'storefront' },
  { id: 'mercado-livre', name: 'Mercado Livre', icon: 'store' },
] as const;

export function SettingsScreen() {
  return (
    <div className="settings-page">
      <header className="inv-page-header">
        <div>
          <div className="inv-page-pretitle">SISTEMA</div>
          <h1 className="inv-page-title">Configurações</h1>
          <p className="inv-page-desc">Acompanhe as conexões com os canais de venda e seus webhooks.</p>
        </div>
      </header>

      <section className="settings-section" aria-labelledby="marketplace-integrations-title">
        <div className="settings-section-heading">
          <div>
            <h2 id="marketplace-integrations-title">Integrações de marketplace</h2>
            <p>O estado será atualizado quando a conexão real estiver implementada no backend.</p>
          </div>
          <span className="settings-status settings-status-neutral">Ainda não configuradas</span>
        </div>

        <div className="settings-integration-list">
          {channels.map((channel) => (
            <article className="settings-integration-card" key={channel.id}>
              <div className="settings-integration-title">
                <span className="settings-channel-icon material-symbols-outlined" aria-hidden="true">{channel.icon}</span>
                <div>
                  <h3>{channel.name}</h3>
                  <span className="settings-status settings-status-neutral">Não configurada</span>
                </div>
              </div>

              <dl className="settings-integration-details">
                <div>
                  <dt>Conexão da API</dt>
                  <dd>Sem credenciais ou verificação configuradas</dd>
                </div>
                <div>
                  <dt>Webhook</dt>
                  <dd>Endpoint e recebimento ainda não configurados</dd>
                </div>
                <div>
                  <dt>Última validação</dt>
                  <dd>Nenhuma validação executada</dd>
                </div>
              </dl>

              <div className="settings-integration-action">
                <button type="button" className="inv-btn inv-btn-secondary" disabled aria-describedby={`${channel.id}-validation-note`}>
                  <span className="material-symbols-outlined" aria-hidden="true">verified</span>
                  Validar integração
                </button>
                <p id={`${channel.id}-validation-note`}>A validação será habilitada após a configuração segura no backend.</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="settings-scope-note">
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        <p>Esta tela não armazena credenciais nem consulta os marketplaces. Nenhum dado de conexão ou webhook foi recebido neste ambiente.</p>
      </aside>
    </div>
  );
}
