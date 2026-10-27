import {useState} from 'react';
import type {FormEvent} from 'react';
import type {CatalogProduct,CatalogVariant} from './api';

export type ProductDraft={name:string;description:string;iconName:string;salePrice:string;cost:string;active:boolean;variants:{name:string;sku:string}[]};
export type VariantDraft={name:string;sku:string;active:boolean};
type Common={busy:boolean;cancel:()=>void};

export function ProductForm({product,busy,cancel,save}:{product?:CatalogProduct;save:(value:ProductDraft)=>Promise<void>} & Common){
  const [name,setName]=useState(product?.name??''),[description,setDescription]=useState(product?.description??''),[iconName,setIconName]=useState(product?.iconName??'sports_soccer'),[salePrice,setSalePrice]=useState(product?.salePrice??''),[cost,setCost]=useState(product?.cost??'');
  const [active,setActive]=useState(product?.active??true),[variants,setVariants]=useState([{name:'Padrão',sku:''}]);
  function submit(event:FormEvent){event.preventDefault();if(!busy)void save({name,description,iconName,salePrice,cost,active,variants});}
  function change(index:number,key:'name'|'sku',value:string){setVariants(items=>items.map((item,i)=>i===index?{...item,[key]:value}:item));}
  return <section className="catalog-editor" aria-label={product?'Editar produto':'Novo produto'}>
    <form onSubmit={submit}>
      <label>Nome do produto<input autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Descrição<textarea aria-label="Descrição" maxLength={2000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} required/></label>
      <div className="catalog-form-row catalog-money-fields"><label>Preço de venda (R$)<input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" required value={salePrice} onChange={e=>setSalePrice(e.target.value)}/></label><label>Custo (R$)<input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" required value={cost} onChange={e=>setCost(e.target.value)}/></label></div>
      <fieldset className="catalog-icon-fieldset"><legend>Ícone do produto</legend><div className="catalog-icon-picker" role="group" aria-label="Ícones esportivos">
        {productIconOptions.map(icon=><button key={icon.name} type="button" className={iconName===icon.name?'catalog-icon-option is-selected':'catalog-icon-option'} aria-label={icon.label} aria-pressed={iconName===icon.name} onClick={()=>setIconName(icon.name)}><span className="material-symbols-outlined" aria-hidden="true">{icon.name}</span><small>{icon.label}</small></button>)}
      </div></fieldset>
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
export const productIconOptions=[
  {name:'checkroom',label:'Camisa'}, {name:'sports',label:'Short'}, {name:'sports_soccer',label:'Bola'},
  {name:'water_bottle',label:'Garrafa'}, {name:'sprint',label:'Meia'}, {name:'apparel',label:'Calça'},
  {name:'sports_tennis',label:'Raquete'}, {name:'sports_basketball',label:'Basquete'},
  {name:'sports_volleyball',label:'Vôlei'}, {name:'fitness_center',label:'Treino'},
  {name:'pool',label:'Natação'}, {name:'backpack',label:'Mochila'}, {name:'sports_martial_arts',label:'Artes marciais'},
] as const;
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
