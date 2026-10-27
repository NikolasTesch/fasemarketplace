import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {Dialog} from '../Dialog';
import {useAccessExpired,useAccessUser} from '../Access';
import {inventoryApi,inventoryMessage,InventoryError,type StockPage,type InventoryBucket,type InventoryMode} from './inventory-api';

export function MovementScreen({revision=0,onSaved}:{revision?:number;onSaved?:()=>void}){
  const [open,setOpen]=useState(false),[count,setCount]=useState(0);
  return <section className="inventory-screen"><header className="inv-page-header"><div><div className="inv-page-pretitle">OPERAÇÕES FÍSICAS</div><h1 className="inv-page-title">Movimentações</h1><p className="inv-page-desc">Priorize entradas manuais no estoque físico. Use ajustes ou transferências para registrar alterações na reserva, Shopee e Mercado Livre.</p></div><button className="inv-btn inv-btn-primary" onClick={()=>setOpen(true)}>Nova movimentação</button></header>
    <div className="inventory-state"><span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span><h2>Movimentos auditáveis por SKU</h2><p>Cada lançamento é salvo no histórico com o usuário responsável. Saídas e transferências respeitam o saldo disponível.</p></div>
    {open&&<Dialog title="Lançar movimentação" onClose={()=>setOpen(false)}><MovementForm key={count} onSaved={()=>{setOpen(false);setCount(n=>n+1);onSaved?.();}} onCancel={()=>setOpen(false)} revision={revision}/></Dialog>}
  </section>;
}

export function MovementForm({onSaved,onCancel,revision=0}:{onSaved:()=>void;onCancel:()=>void;revision?:number}){
  const expired=useAccessExpired(),user=useAccessUser();const [page,setPage]=useState<StockPage|null>(null),[stockOffset,setStockOffset]=useState(0),[selectedItem,setSelectedItem]=useState<StockPage['items'][number]|null>(null),[settings,setSettings]=useState<{mode:InventoryMode}|null>(null),[type,setType]=useState<'INBOUND'|'OUTBOUND'|'ADJUSTMENT'|'TRANSFER'>('INBOUND'),[variantId,setVariantId]=useState(''),[bucket,setBucket]=useState<InventoryBucket>('PHYSICAL_RESERVE'),[source,setSource]=useState<InventoryBucket>('PHYSICAL_RESERVE'),[destination,setDestination]=useState<InventoryBucket>('SHOPEE'),[adjustDirection,setAdjustDirection]=useState<'INCREASE'|'DECREASE'>('INCREASE'),[quantity,setQuantity]=useState('1'),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const requestKey=useRef<{signature:string;key:string}|null>(null);
  const loadingStock=!page||page.offset!==stockOffset;
  useEffect(()=>{const controller=new AbortController();Promise.all([inventoryApi<StockPage>('/stock?offset='+stockOffset,undefined,controller.signal),inventoryApi<{mode:InventoryMode}>('/settings',undefined,controller.signal)]).then(([stocks,setting])=>{if(!controller.signal.aborted){setPage(stocks);setSettings(setting);if(stocks.items[0]){setVariantId(current=>current||stocks.items[0].variantId);setSelectedItem(current=>current||stocks.items[0]);}if(setting.mode==='SHARED'){setBucket('SHARED_CHANNEL');setSource('PHYSICAL_RESERVE');setDestination('SHARED_CHANNEL');}}}).catch(e=>{if(!controller.signal.aborted){setError(inventoryMessage(e));if(e instanceof InventoryError&&(e.status===401||e.status===403))expired?.();}});return()=>controller.abort();},[revision,stockOffset,expired]);
  const channelBuckets:InventoryBucket[]=settings?.mode==='SHARED'?['SHARED_CHANNEL']:['SHOPEE','MERCADO_LIVRE'];const options:InventoryBucket[]=['PHYSICAL_RESERVE',...channelBuckets];
  async function submit(event:FormEvent){event.preventDefault();if(busy||!variantId)return;const amount=Number(quantity);if(!Number.isInteger(amount)||amount<1){setError('Informe uma quantidade inteira maior que zero.');return;}
    const input:Record<string,string|number|undefined>={variantId,type,quantity:amount};if(type==='INBOUND')input.destinationBucket='PHYSICAL_RESERVE';if(type==='OUTBOUND'){input.sourceBucket=bucket;input.reason=reason;}if(type==='ADJUSTMENT'){input.reason=reason;if(adjustDirection==='INCREASE')input.destinationBucket=bucket;else input.sourceBucket=bucket;}if(type==='TRANSFER'){input.sourceBucket=source;input.destinationBucket=destination;input.reason=reason||undefined;}
    if((type==='OUTBOUND'||type==='ADJUSTMENT')&&!window.confirm('Confirmar '+(type==='OUTBOUND'?'saída':'ajuste')+' de '+amount+' unidade(s)?'))return;
    const signature=JSON.stringify(input);if(requestKey.current?.signature!==signature)requestKey.current={signature,key:crypto.randomUUID()};input.idempotencyKey=requestKey.current.key;
    setBusy(true);setError('');try{await inventoryApi('/movements',input);requestKey.current=null;onSaved();}catch(e){setError(inventoryMessage(e));if(e instanceof InventoryError&&(e.status===401||e.status===403))expired?.();}finally{setBusy(false);}
  }
  const bucketOptions=options.map(value=><option key={value} value={value}>{value==='PHYSICAL_RESERVE'?'Reserva física':value==='SHARED_CHANNEL'?'Compartilhado':value==='SHOPEE'?'Shopee':'Mercado Livre'}</option>);
  const selectedVisible=page?.items.some(item=>item.variantId===variantId)??false;
  return <form className="inventory-form" onSubmit={submit}>
    {error&&<p className="inventory-error" role="alert">{error}</p>}
    <label>Tipo de movimentação<select value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="INBOUND">Entrada</option><option value="OUTBOUND">Saída</option><option value="ADJUSTMENT">Ajuste</option><option value="TRANSFER">Transferência</option></select></label>
    <label>SKU<select aria-label="SKU" value={variantId} onChange={e=>{const value=e.target.value;setVariantId(value);const item=page?.items.find(candidate=>candidate.variantId===value);if(item)setSelectedItem(item);}} required><option value="">Selecione um SKU</option>{selectedItem&&!selectedVisible&&<option value={selectedItem.variantId}>{selectedItem.sku} · {selectedItem.productName} — {selectedItem.name}</option>}{page?.items.map(item=><option key={item.variantId} value={item.variantId}>{item.sku} · {item.productName} — {item.name}</option>)}</select></label>
    {loadingStock&&<p className="inventory-hint" role="status">Carregando SKUs…</p>}
    {page&&page.total>page.limit&&<div className="inventory-pagination" aria-label="Paginação de SKUs"><button type="button" className="inv-btn inv-btn-secondary" disabled={loadingStock||stockOffset===0} onClick={()=>setStockOffset(Math.max(0,stockOffset-page.limit))}>SKUs anteriores</button><span>SKUs {page.total===0?0:page.offset+1}–{Math.min(page.offset+page.items.length,page.total)} de {page.total}</span><button type="button" className="inv-btn inv-btn-secondary" disabled={loadingStock||page.offset+page.limit>=page.total} onClick={()=>setStockOffset(page.offset+page.limit)}>Próximos SKUs</button></div>}
    {type==='OUTBOUND'&&<label>Origem<select value={bucket} onChange={e=>setBucket(e.target.value as InventoryBucket)}>{bucketOptions}</select></label>}
    {type==='ADJUSTMENT'&&<div className="inventory-transfer-fields"><label>Ajuste<select value={adjustDirection} onChange={e=>setAdjustDirection(e.target.value as typeof adjustDirection)}><option value="INCREASE">Aumentar saldo</option><option value="DECREASE">Reduzir saldo</option></select></label><label>Bucket<select value={bucket} onChange={e=>setBucket(e.target.value as InventoryBucket)}>{bucketOptions}</select></label></div>}
    {type==='TRANSFER'&&<div className="inventory-transfer-fields"><label>Origem<select value={source} onChange={e=>setSource(e.target.value as InventoryBucket)}>{bucketOptions}</select></label><label>Destino<select value={destination} onChange={e=>setDestination(e.target.value as InventoryBucket)}>{bucketOptions}</select></label></div>}
    <label>Quantidade<input type="number" min="1" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label>
    {(type==='OUTBOUND'||type==='ADJUSTMENT')&&<label>Justificativa<input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} required/></label>}
    {type==='TRANSFER'&&<label>Observação (opcional)<input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
    {type==='INBOUND'&&<p className="inventory-hint">Esta entrada aumenta o estoque físico na reserva. Para registrar saldo destinado à Shopee ou ao Mercado Livre, use uma transferência depois da entrada.</p>}
    {page?.total===0&&<p className="inventory-hint">Cadastre uma variante ativa no Catálogo antes de movimentar estoque.</p>}
    <div className="inventory-form-actions"><button type="button" className="inv-btn inv-btn-secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button type="submit" className="inv-btn inv-btn-primary" disabled={busy||!user||!variantId}>{busy?'Salvando…':'Confirmar movimentação'}</button></div>
  </form>;
}
