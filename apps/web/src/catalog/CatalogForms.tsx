import {useState} from 'react';
import type {FormEvent} from 'react';
import type {CatalogProduct,CatalogVariant} from './api';

export type ProductDraft={name:string;description:string;active:boolean;variants:{name:string;sku:string}[]};
export type VariantDraft={name:string;sku:string;active:boolean};
type Common={busy:boolean;cancel:()=>void};

export function ProductForm({product,busy,cancel,save}:{product?:CatalogProduct;save:(value:ProductDraft)=>Promise<void>} & Common){
  const [name,setName]=useState(product?.name??''),[description,setDescription]=useState(product?.description??'');
  const [active,setActive]=useState(product?.active??true),[variants,setVariants]=useState([{name:'Padrão',sku:''}]);
  function submit(event:FormEvent){event.preventDefault();if(!busy)void save({name,description,active,variants});}
  function change(index:number,key:'name'|'sku',value:string){setVariants(items=>items.map((item,i)=>i===index?{...item,[key]:value}:item));}
  return <section className="catalog-editor" aria-label={product?'Editar produto':'Novo produto'}>
    <form onSubmit={submit}>
      <label>Nome do produto<input autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Descrição<textarea aria-label="Descrição" maxLength={2000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      {product?<label className="catalog-checkbox"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Produto ativo</label>:<>
        <p className="catalog-help">Cada unidade vendável tem um SKU único. Para produto simples, mantenha uma variante “Padrão”.</p>
        {variants.map((variant,index)=><fieldset key={index}>
          <legend>Variante {index+1}</legend><div className="catalog-form-row">
            <label>Nome da variante {index+1}<input required maxLength={100} value={variant.name} onChange={e=>change(index,'name',e.target.value)}/></label>
            <label>SKU {index+1}<input required maxLength={64} autoCapitalize="characters" value={variant.sku} onChange={e=>change(index,'sku',e.target.value.toUpperCase())}/></label>
            {variants.length>1&&<button type="button" className="inv-btn inv-btn-secondary" disabled={busy} aria-label={'Remover variante '+(index+1)} onClick={()=>setVariants(v=>v.filter((_,i)=>i!==index))}>Remover</button>}
          </div>
        </fieldset>)}
        <button type="button" className="inv-btn inv-btn-secondary" disabled={busy||variants.length>=20} onClick={()=>setVariants(v=>[...v,{name:'',sku:''}])}>Adicionar outra variante</button>
        <p className="catalog-help">SKU: letras, números, ponto, hífen ou sublinhado. O código não poderá ser editado depois.</p>
      </>}
      <div className="catalog-actions"><button className="inv-btn inv-btn-primary" disabled={busy}>{busy?'Salvando…':product?'Salvar alterações':'Salvar produto'}</button>
        <button type="button" className="inv-btn inv-btn-secondary" disabled={busy} onClick={cancel}>Cancelar</button></div>
    </form>
  </section>;
}
export function VariantForm({variant,busy,cancel,save}:{product:CatalogProduct;variant?:CatalogVariant;save:(value:VariantDraft)=>Promise<void>} & Common){
  const [name,setName]=useState(variant?.name??''),[sku,setSku]=useState(variant?.sku??''),[active,setActive]=useState(variant?.active??true);
  function submit(event:FormEvent){event.preventDefault();if(!busy)void save({name,sku,active});}
  return <section className="catalog-editor" aria-label={variant?'Editar variante':'Nova variante'}>
    <form onSubmit={submit}>
      <div className="catalog-form-row">
        <label>Nome da variante<input autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>SKU<input required readOnly={!!variant} maxLength={64} value={sku} onChange={e=>setSku(e.target.value.toUpperCase())}/></label>
      </div>
      <p className="catalog-help">{variant?'SKU preservado: o código identifica esta variante e não pode ser alterado.':'Use um código único, que não será reutilizado mesmo se a variante for inativada.'}</p>
      {variant&&<label className="catalog-checkbox"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Variante ativa</label>}
      <div className="catalog-actions"><button className="inv-btn inv-btn-primary" disabled={busy}>{busy?'Salvando…':'Salvar variante'}</button>
        <button type="button" className="inv-btn inv-btn-secondary" disabled={busy} onClick={cancel}>Cancelar</button></div>
    </form>
  </section>;
}
