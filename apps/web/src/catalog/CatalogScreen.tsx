import {useEffect,useState} from 'react';
import {ProductPrices} from './ProductPrices';
import {ProductIcon} from './ProductIcon';
import type {FormEvent} from 'react';
import {useAccessUser,useAccessExpired} from '../Access';
import {catalogApi,CatalogError,catalogMessage} from './api';
import type {CatalogPage,CatalogProduct,CatalogVariant} from './api';
import {ProductForm,VariantForm} from './CatalogForms';
import type {ProductDraft,VariantDraft} from './CatalogForms';
import './catalog.css';
import {Dialog} from '../Dialog';

type Editor={kind:'product';product?:CatalogProduct}|{kind:'variant';product:CatalogProduct;variant?:CatalogVariant}|null;
export function CatalogScreen(){
  const admin=useAccessUser()?.role==='admin',expired=useAccessExpired();
  const [draftSearch,setDraftSearch]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState('all'),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
  const [result,setResult]=useState<{key:string;viewKey:string;data:CatalogPage|null;error:string}>({key:'',viewKey:'',data:null,error:''});
  const [editor,setEditor]=useState<Editor>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const viewKey=JSON.stringify([search,status,offset]),key=JSON.stringify([search,status,offset,revision]),loading=result.key!==key,data=result.viewKey===viewKey?result.data:null;
  useEffect(()=>{
    const controller=new AbortController();
    const query=new URLSearchParams({search,status,offset:String(offset)});
    catalogApi<CatalogPage>('/products?'+query,undefined,controller.signal).then(page=>{
      if(!Array.isArray(page.items)||!Number.isFinite(page.total))throw new Error();
      if(!controller.signal.aborted)setResult({key,viewKey,data:page,error:''});
    }).catch(e=>{
      if(controller.signal.aborted)return;
      setResult({key,viewKey,data:null,error:catalogMessage(e)});
      if(e instanceof CatalogError&&(e.status===401||e.status===403))expired?.();
    });
    return ()=>controller.abort();
  },[key,viewKey,search,status,offset,expired]);
  function reload(){setError('');setRevision(r=>r+1);}
  function open(next:Editor){setError('');setNotice('');setEditor(next);}
  function submitSearch(event:FormEvent){event.preventDefault();setSearch(draftSearch.trim());setOffset(0);reload();}
  async function mutate(path:string,body:unknown,message:string){
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{await catalogApi(path,body);setEditor(null);setNotice(message);setRevision(r=>r+1);}
    catch(e){setError(catalogMessage(e));if(e instanceof CatalogError&&(e.status===401||e.status===403)){setResult({key,viewKey,data:null,error:''});expired?.();}}
    finally{setBusy(false);}
  }
  function saveProduct(value:ProductDraft){
    if(editor?.kind!=='product')return Promise.resolve();
    const p=editor.product;
    if(p?.active&&!value.active&&!window.confirm('Inativar '+p.name+'? Os SKUs e o cadastro serão preservados.'))return Promise.resolve();
    return mutate(p?'/products/'+p.id:'/products',p?
      {name:value.name,description:value.description,iconName:value.iconName,salePrice:value.salePrice,cost:value.cost,active:value.active,version:p.version}:
      {name:value.name,description:value.description,iconName:value.iconName,salePrice:value.salePrice,cost:value.cost,variants:value.variants},p?'Produto atualizado.':'Produto e variantes cadastrados.');
  }
  function saveVariant(value:VariantDraft){
    if(editor?.kind!=='variant')return Promise.resolve();
    const {product,variant}=editor;
    if(variant?.active&&!value.active&&!window.confirm('Inativar a variante '+variant.sku+'? O SKU será preservado.'))return Promise.resolve();
    return mutate(variant?'/variants/'+variant.id:'/products/'+product.id+'/variants',variant?
      {name:value.name,active:value.active,version:variant.version}:
      {name:value.name,sku:value.sku,version:product.version},variant?'Variante atualizada.':'Variante cadastrada.');
  }
  function toggleProduct(p:CatalogProduct){
    if(p.active&&!window.confirm('Inativar '+p.name+'? Os SKUs e o cadastro serão preservados.'))return;
    void mutate('/products/'+p.id,{name:p.name,description:p.description,iconName:p.iconName,active:!p.active,version:p.version},p.active?'Produto inativado.':'Produto ativado.');
  }
  function toggleVariant(v:CatalogVariant){
    if(v.active&&!window.confirm('Inativar a variante '+v.sku+'? O SKU será preservado.'))return;
    void mutate('/variants/'+v.id,{name:v.name,active:!v.active,version:v.version},v.active?'Variante inativada.':'Variante ativada.');
  }
  return <div className="catalog-screen">
    <div className="inv-page-header"><div><div className="inv-page-pretitle">PRODUTOS E VARIANTES</div>
      <h1 className="inv-page-title">Catálogo de produtos</h1><p className="inv-page-desc">Gerencie seus produtos e identifique cada variante com um SKU.</p></div>
      <div className="catalog-actions"><button className="inv-btn inv-btn-secondary" onClick={reload} disabled={busy}>Recarregar</button>
        {admin&&<button className="inv-btn inv-btn-primary" onClick={()=>open({kind:'product'})} disabled={busy}>Novo produto</button>}</div>
    </div>
    <div className="catalog-explainer"><strong>Produto → Variante → SKU</strong><span>Exemplo: Camiseta treino → Preta / M → CAM-PRETA-M.</span>
      <span>Movimentações e saldos físicos serão disponibilizados na próxima entrega.</span></div>
    {notice&&<p className="inv-banner-success" role="status">{notice}</p>}
    {!editor&&(error||(!loading&&result.error))&&<p className="catalog-error" role="alert">{error||result.error} <button className="inv-btn inv-btn-secondary" onClick={reload}>Tentar novamente</button></p>}
    <form className="catalog-toolbar" onSubmit={submitSearch}>
      <label>Buscar produtos ou SKUs<input value={draftSearch} maxLength={80} placeholder="Nome do produto, variante ou SKU" onChange={e=>setDraftSearch(e.target.value)}/></label>
      <label>Status do produto<select aria-label="Status do produto" value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);setError('');}}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label>
      <button className="inv-btn inv-btn-secondary" type="submit">Buscar</button>
    </form>
    {editor&&<Dialog title={editor.kind==='product'?(editor.product?'Editar produto · '+editor.product.name:'Novo produto'):(editor.variant?'Editar variante · '+editor.variant.sku:'Nova variante · '+editor.product.name)} busy={busy} onClose={()=>setEditor(null)}>
      {error&&<p className="catalog-error" role="alert">{error}</p>}
      {editor.kind==='product'&&<ProductForm key={editor.product?.id??'new-product'} product={editor.product} save={saveProduct} busy={busy} cancel={()=>setEditor(null)}/>}
    {editor.kind==='variant'&&<VariantForm key={editor.variant?.id??'new-variant-'+editor.product.id} product={editor.product} variant={editor.variant} save={saveVariant} busy={busy} cancel={()=>setEditor(null)}/>}
    </Dialog>}
    {loading&&<p className="catalog-empty" role="status">Carregando catálogo…</p>}
    {data&&<>
      <p className="catalog-count">{data.total} {data.total===1?'produto encontrado':'produtos encontrados'} · {data.items.reduce((n,p)=>n+p.variantCount,0)} variantes nesta página</p>
      {data.items.length===0&&<div className="catalog-empty"><h2>{search||status!=='all'?'Nenhum produto encontrado':'Seu catálogo começa aqui'}</h2>
        <p>{admin?'Cadastre um produto e sua primeira variante para começar.':'Nenhum cadastro disponível para consulta.'}</p></div>}
      <div className="catalog-products">{data.items.map(p=><article className="catalog-product" key={p.id} aria-label={'Produto '+p.name}>
        <header><div className="catalog-product-identity"><ProductIcon name={p.iconName} className="catalog-product-icon material-symbols-outlined"/><div><h2>{p.name}</h2><span className={'catalog-badge '+(p.active?'is-active':'is-inactive')}>{p.active?'Produto ativo':'Produto inativo'}</span></div></div><ProductPrices salePrice={p.salePrice} cost={p.cost} showCost={admin}/>
          {admin&&<div className="catalog-actions"><button className="inv-btn inv-btn-secondary" aria-label={'Editar produto '+p.name} disabled={busy} onClick={()=>open({kind:'product',product:p})}>Editar produto</button>
            <button className="inv-btn inv-btn-secondary" aria-label={(p.active?'Inativar':'Ativar')+' produto '+p.name} disabled={busy} onClick={()=>toggleProduct(p)}>{p.active?'Inativar':'Ativar'} produto</button></div>}</header>
        {p.description&&<p className="catalog-description">{p.description}</p>}
        <div className="catalog-variant-heading"><strong>Variantes e SKUs ({p.variantCount})</strong>
          {admin&&<button className="inv-btn inv-btn-secondary" disabled={busy||p.variantCount>=50} aria-label={'Adicionar variante em '+p.name} onClick={()=>open({kind:'variant',product:p})}>Nova variante</button>}</div>
        {p.variants.map(v=><div className="catalog-variant" key={v.id}>
          <div><strong>{v.name}</strong><code>{v.sku}</code></div>
          <span className={'catalog-badge '+(v.effectiveActive?'is-active':'is-inactive')}>{!v.active?'Variante inativa':v.effectiveActive?'Ativa':'Produto inativo'}</span>
          {admin&&<div className="catalog-actions"><button className="inv-btn inv-btn-secondary" disabled={busy} aria-label={'Editar variante '+v.sku} onClick={()=>open({kind:'variant',product:p,variant:v})}>Editar</button>
            <button className="inv-btn inv-btn-secondary" disabled={busy} aria-label={(v.active?'Inativar':'Ativar')+' variante '+v.sku} onClick={()=>toggleVariant(v)}>{v.active?'Inativar':'Ativar'}</button></div>}
        </div>)}
      </article>)}</div>
      <div className="catalog-pagination"><span>Exibindo {data.items.length?offset+1:0}–{offset+data.items.length} de {data.total}</span>
        <div className="catalog-actions"><button className="inv-btn inv-btn-secondary" disabled={offset===0||busy} onClick={()=>setOffset(n=>Math.max(0,n-20))}>Anterior</button>
          <button className="inv-btn inv-btn-secondary" disabled={offset+20>=data.total||busy} onClick={()=>setOffset(n=>n+20)}>Próxima</button></div></div>
    </>}
  </div>;
}
