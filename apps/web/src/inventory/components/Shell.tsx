import type {ReactNode} from 'react';
import type {ViewScreen} from '../types';
import logo from '../../assets/fase-sport-logo.svg';
import {useAccessUser,useAccessActions} from '../../Access';

interface ShellProps{currentScreen:ViewScreen;onNavigate:(screen:ViewScreen)=>void;onOpenMovementModal:()=>void;children:ReactNode;}
export function Shell({currentScreen,onNavigate,onOpenMovementModal,children}:ShellProps){
 const user=useAccessUser(),actions=useAccessActions();
 const mode=import.meta.env.VITE_DEVELOPMENT_MODE;
 const envLabel=mode==='production'?'Production':mode==='preview'?'Preview':mode==='hybrid'?'Desenvolvimento híbrido':'Desenvolvimento local';
 const entries:{id:ViewScreen;label:string;icon:string}[]=[
  {id:'stock',label:'Estoque físico',icon:'inventory_2'},
  {id:'movement',label:'Movimentações',icon:'swap_vert'},
  {id:'audit',label:'Histórico de movimentações',icon:'receipt_long'},
  ...(import.meta.env.VITE_CATALOG_ENABLED==='true'?[{id:'catalog' as const,label:'Catálogo',icon:'category'}]:[]),
  ...(user?[{id:'users' as const,label:'Usuários',icon:'group'}]:[]),
  ...(user&&(mode===undefined||mode==='local')?[{id:'tickets' as const,label:'Bugs e melhorias',icon:'feedback'}]:[]),
  ...(import.meta.env.VITE_CATALOG_ENABLED==='true'?[{id:'settings' as const,label:'Configurações',icon:'settings'}]:[]),
  {id:'diagnostics',label:'Diagnóstico do sistema',icon:'terminal'},
 ];
 return <div className="inv-app">
  <aside className="inv-sidebar" aria-label="Navegação do sistema">
   <div className="inv-sidebar-logo"><img src={logo} alt="Fase Sport" className="inv-logo-img"/><div className="inv-logo-sub">GESTÃO DE ESTOQUE</div></div>
   <button className="inv-btn inv-btn-primary workspace-movement" onClick={onOpenMovementModal}><span className="material-symbols-outlined" aria-hidden="true">add_circle</span>Lançar Movimentação</button>
   <nav className="inv-nav">{entries.map(entry=><button key={entry.id} type="button" className={'inv-nav-btn '+(currentScreen===entry.id?'active':'')} aria-current={currentScreen===entry.id?'page':undefined} onClick={()=>onNavigate(entry.id)}><span className="material-symbols-outlined" aria-hidden="true">{entry.icon}</span><span>{entry.label}</span></button>)}</nav>
   <div className="inv-sidebar-footer">Fase Sport · Gestão de estoque</div>
  </aside>
  <div className="inv-main-wrapper">
   <header className="inv-topbar">
    <select className="inv-mobile-nav" aria-label="Navegar entre telas" value={currentScreen} onChange={event=>onNavigate(event.target.value as ViewScreen)}>{entries.map(entry=><option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
    <div className="inv-topbar-left"><span className="inv-env-badge"><span className="inv-env-dot"/>{envLabel}</span></div>
    {user&&<div className="inv-topbar-right"><div className="inv-user-chip"><div className="inv-user-avatar" aria-hidden="true">{user.name.slice(0,2).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.role==='admin'?'Administrador':'Usuário'}</small></div></div>
      <button type="button" className="inv-btn inv-btn-secondary" disabled={actions?.busy} onClick={()=>void actions?.logout()}><span className="material-symbols-outlined" aria-hidden="true">logout</span>Sair</button>
    </div>}
   </header>
   <main className="inv-content">{children}</main>
  </div>
 </div>;
}
