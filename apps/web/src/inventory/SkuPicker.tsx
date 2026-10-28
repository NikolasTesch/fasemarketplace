import {useEffect,useRef,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {inventoryApi,type StockItem,type StockPage} from './inventory-api';
import {ProductIcon} from '../catalog/ProductIcon';

export function SkuPicker({selected,onSelect}:{selected:StockItem|null;onSelect:(item:StockItem)=>void}){
  const [open,setOpen]=useState(!selected),[query,setQuery]=useState(''),[results,setResults]=useState<StockItem[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState(''),[activeIndex,setActiveIndex]=useState(0);
  const input=useRef<HTMLInputElement>(null),toggle=useRef<HTMLButtonElement>(null);
  const hasQuery=query.trim().length>0;
  useEffect(()=>{if(!open||!hasQuery)return;const controller=new AbortController(),timer=window.setTimeout(()=>{
    setLoading(true);setError('');
    inventoryApi<StockPage>('/stock?offset=0&search='+encodeURIComponent(query.trim()),undefined,controller.signal).then(page=>{if(!controller.signal.aborted){setResults(page.items);setTotal(page.total);setActiveIndex(0);}}).catch(()=>{if(!controller.signal.aborted){setResults([]);setTotal(0);setError('Não foi possível buscar os SKUs. Tente novamente.');}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  },220);return()=>{window.clearTimeout(timer);controller.abort();};},[open,query,hasQuery]);
  useEffect(()=>{if(open)input.current?.focus();},[open]);
  useEffect(()=>{if(!open&&selected)toggle.current?.focus();},[open,selected]);
  function choose(item:StockItem){onSelect(item);setOpen(false);setQuery('');}
  function keyDown(event:KeyboardEvent<HTMLInputElement>){
    if((event.key==='ArrowDown'||event.key==='ArrowUp')&&results.length){event.preventDefault();const direction=event.key==='ArrowDown'?1:-1,next=Math.max(0,Math.min(activeIndex+direction,results.length-1));setActiveIndex(next);document.getElementById(`sku-option-${results[next].variantId}`)?.scrollIntoView({block:'nearest'});}
    else if(event.key==='Enter'&&results[activeIndex]){event.preventDefault();choose(results[activeIndex]);}
    else if(event.key==='Escape'&&selected){event.preventDefault();setOpen(false);setQuery('');}
  }
  return <div className="sku-picker" role="group" aria-label="Selecionar SKU">
    {selected&&!open&&<div className="sku-picker-selected"><ProductIcon name={selected.iconName||'inventory_2'}/><span className="sku-picker-selected-copy"><strong>{selected.sku}</strong><span>{selected.productName} · {selected.name}</span></span><button ref={toggle} type="button" className="inv-btn inv-btn-secondary" onClick={()=>setOpen(true)}>Trocar SKU</button></div>}
    {open&&<div className="sku-picker-search"><label htmlFor="sku-search">Buscar produto ou SKU</label><div className="sku-picker-input-wrap"><span className="material-symbols-outlined" aria-hidden="true">search</span><input ref={input} id="sku-search" role="combobox" aria-expanded={hasQuery} aria-haspopup="listbox" type="search" maxLength={80} autoComplete="off" value={query} onChange={event=>{const value=event.target.value;setQuery(value);setResults([]);setTotal(0);setError('');setActiveIndex(0);setLoading(value.trim().length>0);}} onKeyDown={keyDown} placeholder="Digite o SKU ou nome do produto" aria-controls={hasQuery?'sku-picker-results':undefined} aria-autocomplete="list" aria-activedescendant={results[activeIndex]?`sku-option-${results[activeIndex].variantId}`:undefined}/></div>
      {hasQuery&&<div id="sku-picker-results" className="sku-picker-results" role="listbox" aria-label="SKUs encontrados" aria-busy={loading}>
        {loading&&<p className="sku-picker-state" role="status">Buscando SKUs…</p>}
        {!loading&&error&&<p className="sku-picker-state" role="alert">{error}</p>}
        {!loading&&!error&&results.map((item,index)=><button id={`sku-option-${item.variantId}`} key={item.variantId} type="button" role="option" aria-selected={index===activeIndex} className={index===activeIndex?'sku-picker-option is-active':'sku-picker-option'} onMouseEnter={()=>setActiveIndex(index)} onClick={()=>choose(item)}><ProductIcon name={item.iconName||'inventory_2'}/><span><strong>{item.sku}</strong><small>{item.productName} · {item.name}</small></span><span className="sku-picker-balance">{item.total} un.</span></button>)}
        {!loading&&!error&&results.length===0&&<p className="sku-picker-state">Nenhum SKU corresponde à busca.</p>}
      </div>}
      <p className="sku-picker-hint">{hasQuery?(loading?'Buscando SKUs…':results.length<total?`Mostrando ${results.length} de ${total} SKUs.`:`${results.length} SKU(s) encontrado(s).`):'Digite para buscar por SKU ou nome do produto.'}</p>
    </div>}
    {!open&&selected&&<input type="hidden" name="variantId" value={selected.variantId}/>}
  </div>;
}
