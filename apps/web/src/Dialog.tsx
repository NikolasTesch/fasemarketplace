import {useEffect,useId,useRef} from 'react';
import type {ReactNode} from 'react';
import './dialog.css';

export function Dialog({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}){
  const ref=useRef<HTMLDialogElement>(null),heading=useId();
  useEffect(()=>{
    const dialog=ref.current,trigger=document.activeElement;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[autofocus]')?.focus();
    return ()=>{dialog?.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus();};
  },[]);
  return <dialog ref={ref} className="app-dialog" aria-labelledby={heading} onCancel={event=>{event.preventDefault();if(!busy)onClose();}} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(element=>element.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}>
    <header className="app-dialog-header"><h2 id={heading}>{title}</h2><button type="button" className="inv-btn inv-btn-secondary" aria-label="Fechar modal" disabled={busy} onClick={onClose}>×</button></header>
    <div className="app-dialog-body">{children}</div>
  </dialog>;
}
