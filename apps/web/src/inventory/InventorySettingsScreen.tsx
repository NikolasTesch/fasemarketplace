import {useEffect,useState} from 'react';
import {useAccessExpired,useAccessUser} from '../Access';
import {inventoryApi,inventoryMessage,InventoryError,type InventoryMode,type InventorySettings} from './inventory-api';

export function InventorySettingsScreen({revision=0}:{revision?:number}){
  const admin=useAccessUser()?.role==='admin',expired=useAccessExpired();const [settings,setSettings]=useState<InventorySettings|null>(null),[mode,setMode]=useState<InventoryMode>('SEPARATE'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  useEffect(()=>{const controller=new AbortController();inventoryApi<InventorySettings>('/settings',undefined,controller.signal).then(value=>{if(!controller.signal.aborted){setSettings(value);setMode(value.mode);setError('');}}).catch(e=>{if(!controller.signal.aborted){setError(inventoryMessage(e));if(e instanceof InventoryError&&(e.status===401||e.status===403))expired?.();}});return()=>controller.abort();},[reload,revision,expired]);
  async function save(){if(!settings||busy||!admin)return;setBusy(true);setError('');setNotice('');try{const next=await inventoryApi<InventorySettings>('/settings/mode',{mode,version:settings.version});setSettings(next);setNotice('Modo de estoque atualizado.');}catch(e){setError(inventoryMessage(e));if(e instanceof InventoryError&&(e.status===401||e.status===403))expired?.();}finally{setBusy(false);}}
  return <section className="inventory-screen"><header className="inv-page-header"><div><div className="inv-page-pretitle">CONFIGURAÇÃO LOCAL</div><h1 className="inv-page-title">Configurações de estoque</h1><p className="inv-page-desc">Defina como o saldo será destinado aos marketplaces.</p></div><button className="inv-btn inv-btn-secondary" onClick={()=>setReload(value=>value+1)} disabled={busy}>Recarregar</button></header>
    {notice&&<p className="inv-banner-success" role="status">{notice}</p>}{error&&<p className="inventory-error" role="alert">{error}</p>}
    <article className="inv-card inventory-settings-card"><h2>Modo de estoque</h2><p>O saldo mínimo é configurado por SKU na tela Estoque físico e considera o total de unidades em todos os buckets.</p>
      <label htmlFor="inventory-mode">Destinação do estoque</label><select id="inventory-mode" value={mode} disabled={!admin||!settings||busy} onChange={event=>setMode(event.target.value as InventoryMode)}><option value="SEPARATE">Separado por canal</option><option value="SHARED">Saldo compartilhado entre canais</option></select>
      {mode==='SEPARATE'?<p>Shopee e Mercado Livre mantêm buckets independentes. Transfira as unidades de volta à reserva antes de mudar para compartilhado.</p>:<p>Os dois canais usam o mesmo bucket. Uma baixa registrada para qualquer canal reduz o saldo comum uma única vez.</p>}
      {!admin&&<p className="inventory-hint">Somente administrador pode alterar o modo de estoque.</p>}{admin&&<button className="inv-btn inv-btn-primary" disabled={!settings||busy||mode===settings.mode} onClick={()=>void save()}>{busy?'Salvando…':'Salvar modo'}</button>}
    </article>
  </section>;
}
