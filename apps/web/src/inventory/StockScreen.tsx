import {useEffect,useState} from 'react';
import {useAccessExpired,useAccessUser} from '../Access';
import {inventoryApi,inventoryMessage,type StockPage,type StockItem,InventoryError} from './inventory-api';
import {Dialog} from '../Dialog';
import {ProductForm,type ProductDraft} from '../catalog/CatalogForms';
import {catalogApi,catalogMessage} from '../catalog/api';
import {ProductPrices,formatMoney} from '../catalog/ProductPrices';
import {ProductIcon} from '../catalog/ProductIcon';
import '../catalog/catalog.css';

async function loadStock(search:string,signal:AbortSignal):Promise<StockPage>{
  const query=encodeURIComponent(search.trim());
  const first=await inventoryApi<StockPage>('/stock?offset=0&search='+query,undefined,signal);
  const items=[...first.items];
  for(let offset=first.limit;offset<first.total;offset+=first.limit){
    const page=await inventoryApi<StockPage>('/stock?offset='+offset+'&search='+query,undefined,signal);
    items.push(...page.items);
  }
  return {...first,items,total:items.length};
}

type ProductStockGroup={productId:string;productName:string;iconName:string;items:StockItem[]};
function groupByProduct(items:StockItem[]):ProductStockGroup[]{
  const groups=new Map<string,ProductStockGroup>();
  for(const item of items){
    const group=groups.get(item.productId)??{productId:item.productId,productName:item.productName,iconName:item.iconName,items:[]};
    group.items.push(item);groups.set(item.productId,group);
  }
  return [...groups.values()].sort((a,b)=>a.productName.localeCompare(b.productName,'pt-BR'));
}

export function StockScreen({revision=0}:{revision?:number}){
  const admin=useAccessUser()?.role==='admin',expired=useAccessExpired();
  const [search,setSearch]=useState(''),[result,setResult]=useState<{key:string;data:StockPage|null;error:string}>({key:'',data:null,error:''}),[refresh,setRefresh]=useState(0),[minimums,setMinimums]=useState<Record<string,string>>({}),[busy,setBusy]=useState(''),[notice,setNotice]=useState('');
  const [createOpen,setCreateOpen]=useState(false),[createBusy,setCreateBusy]=useState(false),[createError,setCreateError]=useState('');
  const key=JSON.stringify([revision,refresh,search.trim()]),loading=result.key!==key,page=result.key===key?result.data:null,groups=page?groupByProduct(page.items):[];
  useEffect(()=>{
    const controller=new AbortController(),timer=window.setTimeout(()=>{
      loadStock(search,controller.signal).then(data=>{if(!controller.signal.aborted)setResult({key,data,error:''});}).catch(error=>{
        if(controller.signal.aborted)return;
        setResult({key,data:null,error:inventoryMessage(error)});
        if(error instanceof InventoryError&&(error.status===401||error.status===403))expired?.();
      });
    },search.trim()?220:0);
    return ()=>{window.clearTimeout(timer);controller.abort();};
  },[key,search,expired]);
  async function saveMinimum(item:StockItem){const value=Number(minimums[item.variantId]??item.minimumQuantity??0);if(!Number.isInteger(value)||value<0){setNotice('Informe um mínimo inteiro igual ou maior que zero.');return;}setBusy(item.variantId);setNotice('');try{await inventoryApi('/variants/'+item.variantId+'/minimum',{minimumQuantity:value,...(item.minimumVersion===null?{}:{version:item.minimumVersion})});setNotice('Estoque mínimo atualizado.');setRefresh(n=>n+1);}catch(error){setNotice(inventoryMessage(error));if(error instanceof InventoryError&&(error.status===401||error.status===403))expired?.();}finally{setBusy('');}}
  async function createProduct(value:ProductDraft){if(createBusy)return;setCreateBusy(true);setCreateError('');try{await catalogApi('/products',{name:value.name,description:value.description,iconName:value.iconName,salePrice:value.salePrice,cost:value.cost,variants:value.variants});setCreateOpen(false);setRefresh(n=>n+1);setNotice('Produto cadastrado no catálogo.');}catch(error){setCreateError(catalogMessage(error));}finally{setCreateBusy(false);}}
  return <section className="inventory-screen">
    <header className="inv-page-header"><div><div className="inv-page-pretitle">SALDOS POR PRODUTO</div><h1 className="inv-page-title">Estoque físico</h1><p className="inv-page-desc">Acompanhe o saldo de cada produto e consulte suas variantes, SKUs e mínimos.</p></div><div className="catalog-actions">{admin&&import.meta.env.VITE_CATALOG_ENABLED==='true'&&<button className="inv-btn inventory-register-product" type="button" onClick={()=>{setCreateError('');setCreateOpen(true);}}><span className="material-symbols-outlined" aria-hidden="true">add_box</span>Cadastrar produto</button>}<button className="inv-btn inv-btn-secondary" type="button" onClick={()=>setRefresh(n=>n+1)} disabled={loading}>Recarregar</button></div></header>
    {notice&&<p className="inv-banner-success" role="status">{notice}</p>}
    <form className="inventory-stock-toolbar" role="search" onSubmit={event=>event.preventDefault()}>
      <label htmlFor="inventory-product-search">Buscar produto, variante ou SKU</label>
      <div className="inventory-stock-search-wrap"><span className="material-symbols-outlined" aria-hidden="true">search</span><input id="inventory-product-search" type="search" maxLength={80} autoComplete="off" placeholder="Digite o nome do produto, variante ou SKU" value={search} onChange={event=>setSearch(event.target.value)}/>{search&&<button type="button" aria-label="Limpar busca" onClick={()=>setSearch('')}>×</button>}</div>
    </form>
    {loading&&<p className="inventory-state" role="status">{search?'Buscando produtos e SKUs…':'Carregando estoque…'}</p>}
    {!loading&&result.error&&<div className="inventory-state" role="alert"><p>{result.error}</p><button className="inv-btn inv-btn-secondary" onClick={()=>setRefresh(n=>n+1)}>Tentar novamente</button></div>}
    {!loading&&page&&page.total===0&&<div className="inventory-state"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span><h2>{search?'Nenhum produto ou SKU encontrado':'Nenhuma variante ativa no catálogo'}</h2><p>{search?'Tente buscar por outro nome, variante ou código SKU.':'Cadastre ou ative variantes no Catálogo para iniciar o controle de estoque.'}</p>{search&&<button className="inv-btn inv-btn-secondary" type="button" onClick={()=>setSearch('')}>Limpar busca</button>}</div>}
    {!loading&&page&&page.total>0&&<>
      <div className="inventory-summary"><span>{groups.length} {groups.length===1?'produto':'produtos'} · {page.total} {page.total===1?'SKU ativo':'SKUs ativos'}</span><span>Modo {page.mode==='SHARED'?'compartilhado':'separado'}</span></div>
      <div className="inventory-product-stock-list">{groups.map(group=>{
        const productTotal=group.items.reduce((sum,item)=>sum+item.total,0);
        return <article className="catalog-product inventory-product-stock" key={group.productId} aria-label={'Estoque de '+group.productName}>
          <header><div className="catalog-product-identity"><ProductIcon name={group.iconName} className="catalog-product-icon material-symbols-outlined"/><div><h2>{group.productName}</h2><span className="catalog-badge is-active">{group.items.length} {group.items.length===1?'SKU':'SKUs'}</span></div></div><ProductPrices salePrice={group.items[0].salePrice} cost={group.items[0].cost} showCost={admin}/><strong className="inventory-product-total"><span>Total das variantes exibidas</span>{productTotal} un.</strong></header>
          <div className="catalog-variant-heading"><strong>Variantes e saldos</strong></div>
          <div className="inventory-product-variants">{group.items.map(item=><div className="inventory-product-variant" key={item.variantId}>
            <div className="inventory-product-variant-identity"><strong>{item.name}</strong><code>{item.sku}</code></div>
            <div className="inventory-product-buckets"><div><span>Reserva física</span><strong>{item.physicalReserve}</strong></div>{page.mode==='SHARED'?<div><span>Compartilhado</span><strong>{item.sharedChannel??0}</strong></div>:<><div><span>Shopee</span><strong>{item.shopee??0}</strong></div><div><span>Mercado Livre</span><strong>{item.mercadoLivre??0}</strong></div></>}</div>
            <div className={item.belowMinimum?'inventory-minimum is-low':'inventory-minimum'}><span>Total · mínimo</span><strong>{item.total} · {item.minimumQuantity===null?'—':item.minimumQuantity}</strong>{item.belowMinimum&&<b>Mínimo atingido</b>}</div>
            {admin&&<form className="inventory-min-form" onSubmit={event=>{event.preventDefault();void saveMinimum(item);}}><label htmlFor={'minimum-'+item.variantId}>Mínimo</label><input id={'minimum-'+item.variantId} type="number" min="0" step="1" aria-label={'Estoque mínimo de '+item.sku} value={minimums[item.variantId]??(item.minimumQuantity===null?'':String(item.minimumQuantity))} onChange={event=>setMinimums(values=>({...values,[item.variantId]:event.target.value}))}/><button className="inv-btn inv-btn-secondary" aria-label={'Salvar mínimo de '+item.sku} disabled={busy===item.variantId||loading}>Salvar</button></form>}
          </div>)}</div>
          <div className="inventory-stock-value"><span>Valor do estoque das variantes exibidas</span><div>{admin&&<div><small>Ao custo</small><strong>{formatMoney(group.items[0].cost,productTotal)}</strong></div>}<div><small>Potencial de venda</small><strong>{formatMoney(group.items[0].salePrice,productTotal)}</strong></div></div></div>
        </article>;
      })}</div>
    </>}
    {createOpen&&<Dialog title="Cadastrar produto" busy={createBusy} onClose={()=>setCreateOpen(false)}>{createError&&<p className="inventory-error" role="alert">{createError}</p>}<ProductForm save={createProduct} busy={createBusy} cancel={()=>setCreateOpen(false)}/></Dialog>}
  </section>;
}
