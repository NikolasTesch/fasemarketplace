import {useEffect,useState} from 'react';
import {useAccessExpired,useAccessUser} from '../Access';
import {inventoryApi,inventoryMessage,type StockPage,type StockItem,InventoryError} from './inventory-api';
import {Dialog} from '../Dialog';
import {ProductForm,type ProductDraft} from '../catalog/CatalogForms';
import {catalogApi,catalogMessage} from '../catalog/api';

export function StockScreen({revision=0}:{revision?:number}){
  const admin=useAccessUser()?.role==='admin',expired=useAccessExpired();
  const [offset,setOffset]=useState(0),[result,setResult]=useState<{key:string;data:StockPage|null;error:string}>({key:'',data:null,error:''}),[refresh,setRefresh]=useState(0),[minimums,setMinimums]=useState<Record<string,string>>({}),[busy,setBusy]=useState(''),[notice,setNotice]=useState('');
  const [createOpen,setCreateOpen]=useState(false),[createBusy,setCreateBusy]=useState(false),[createError,setCreateError]=useState('');
  const key=String(revision)+':'+refresh+':'+offset,loading=result.key!==key,data=result.key===key?result.data:null;
  useEffect(()=>{const controller=new AbortController();inventoryApi<StockPage>('/stock?offset='+offset+'&search=',undefined,controller.signal).then(page=>{if(!Array.isArray(page.items)||!Number.isFinite(page.total))throw new Error();if(!controller.signal.aborted)setResult({key,data:page,error:''});}).catch(error=>{if(controller.signal.aborted)return;setResult({key,data:null,error:inventoryMessage(error)});if(error instanceof InventoryError&&(error.status===401||error.status===403))expired?.();});return()=>controller.abort();},[key,expired,offset]);
  async function saveMinimum(item:StockItem){const value=Number(minimums[item.variantId]??item.minimumQuantity??0);if(!Number.isInteger(value)||value<0){setNotice('Informe um mínimo inteiro igual ou maior que zero.');return;}setBusy(item.variantId);setNotice('');try{await inventoryApi('/variants/'+item.variantId+'/minimum',{minimumQuantity:value,...(item.minimumVersion===null?{}:{version:item.minimumVersion})});setNotice('Estoque mínimo atualizado.');setRefresh(n=>n+1);}catch(error){setNotice(inventoryMessage(error));if(error instanceof InventoryError&&(error.status===401||error.status===403))expired?.();}finally{setBusy('');}}
  async function createProduct(value:ProductDraft){if(createBusy)return;setCreateBusy(true);setCreateError('');try{await catalogApi('/products',{name:value.name,description:value.description,iconName:value.iconName,salePrice:value.salePrice,cost:value.cost,variants:value.variants});setCreateOpen(false);setRefresh(n=>n+1);setNotice('Produto cadastrado no catálogo.');}catch(error){setCreateError(catalogMessage(error));}finally{setCreateBusy(false);}}
  const page=data;
  return <section className="inventory-screen">
    <header className="inv-page-header"><div><div className="inv-page-pretitle">SALDOS POR SKU</div><h1 className="inv-page-title">Estoque físico</h1><p className="inv-page-desc">Acompanhe a reserva física, as destinações por canal e o mínimo definido para cada variante.</p></div><div className="catalog-actions">{admin&&import.meta.env.VITE_CATALOG_ENABLED==='true'&&<button className="inv-btn inventory-register-product" type="button" onClick={()=>{setCreateError('');setCreateOpen(true);}}><span className="material-symbols-outlined" aria-hidden="true">add_box</span>Cadastrar produto</button>}<button className="inv-btn inv-btn-secondary" type="button" onClick={()=>setRefresh(n=>n+1)} disabled={loading}>Recarregar</button></div></header>
    {notice&&<p className="inv-banner-success" role="status">{notice}</p>}
    {loading&&<p className="inventory-state" role="status">Carregando saldos…</p>}
    {!loading&&result.error&&<div className="inventory-state" role="alert"><p>{result.error}</p><button className="inv-btn inv-btn-secondary" onClick={()=>setRefresh(n=>n+1)}>Tentar novamente</button></div>}
    {!loading&&page&&page.items.length===0&&<div className="inventory-state"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span><h2>{page.total===0?'Nenhuma variante ativa no catálogo':'Nenhum SKU nesta página'}</h2><p>Cadastre ou ative variantes no Catálogo para iniciar o controle de estoque.</p></div>}
    {!loading&&page&&page.items.length>0&&<>
      <div className="inventory-summary"><span>{page.total} {page.total===1?'SKU ativo':'SKUs ativos'}</span><span>Modo {page.mode==='SHARED'?'compartilhado':'separado'}</span></div>
      <div className="inventory-stock-list">{page.items.map(item=><article className="inventory-stock-card" key={item.variantId}>
        <header><div className="inventory-stock-identity"><span className="material-symbols-outlined inventory-stock-icon" aria-hidden="true">{item.iconName}</span><div><h2>{item.productName}</h2><p>{item.name} <code>{item.sku}</code></p></div></div><strong className="inventory-total"><span>Total</span>{item.total}</strong></header>
        <div className="inventory-buckets"><div><span>Reserva física</span><strong>{item.physicalReserve}</strong></div>{page.mode==='SHARED'?<div><span>Compartilhado · Shopee e Mercado Livre</span><strong>{item.sharedChannel??0}</strong></div>:<><div><span>Shopee</span><strong>{item.shopee??0}</strong></div><div><span>Mercado Livre</span><strong>{item.mercadoLivre??0}</strong></div></>}</div>
        <footer><div className={item.belowMinimum?'inventory-minimum is-low':'inventory-minimum'}><span>Estoque mínimo</span><strong>{item.minimumQuantity===null?'Não definido':item.minimumQuantity}</strong>{item.belowMinimum&&<b>Estoque mínimo atingido</b>}</div>
          {admin&&<form className="inventory-min-form" onSubmit={event=>{event.preventDefault();void saveMinimum(item);}}><label htmlFor={'minimum-'+item.variantId}>Definir mínimo</label><input id={'minimum-'+item.variantId} type="number" min="0" step="1" value={minimums[item.variantId]??(item.minimumQuantity===null?'':String(item.minimumQuantity))} onChange={event=>setMinimums(values=>({...values,[item.variantId]:event.target.value}))}/><button className="inv-btn inv-btn-secondary" disabled={busy===item.variantId||loading}>Salvar mínimo</button></form>}
        </footer>
      </article>)}</div><div className="catalog-pagination"><span>Exibindo {offset+1}–{Math.min(offset+page.items.length,page.total)} de {page.total}</span><div className="catalog-actions"><button className="inv-btn inv-btn-secondary" disabled={!offset||loading} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Anterior</button><button className="inv-btn inv-btn-secondary" disabled={offset+20>=page.total||loading} onClick={()=>setOffset(value=>value+20)}>Próxima</button></div></div>
    </>}
    {createOpen&&<Dialog title="Cadastrar produto" busy={createBusy} onClose={()=>setCreateOpen(false)}>{createError&&<p className="inventory-error" role="alert">{createError}</p>}<ProductForm save={createProduct} busy={createBusy} cancel={()=>setCreateOpen(false)}/></Dialog>}
  </section>;
}
