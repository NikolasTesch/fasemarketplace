import { createContext, useContext, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import logo from '../../../docs/assets/fase-sport-logo.svg';
import './access.css';
import {Dialog} from './Dialog';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  mustChangePassword: boolean;
  banned: boolean;
};
const AccessUserContext = createContext<User | null>(null);
const AccessActionsContext = createContext<{logout:()=>Promise<void>;refresh:()=>Promise<void>;busy:boolean}|null>(null);
export function useAccessActions(){return useContext(AccessActionsContext);}
const AccessExpiredContext = createContext<(()=>void) | null>(null);
export function useAccessExpired() { return useContext(AccessExpiredContext); }
export function useAccessUser() {
  return useContext(AccessUserContext);
}
class AccessError extends Error {
  constructor(readonly status: number) {
    super(
      status === 429
        ? 'Muitas tentativas. Aguarde 15 minutos.'
        : status === 503
          ? 'Acesso indisponível. Tente novamente.'
          : status === 401
            ? 'Sessão ou credenciais inválidas.'
            : status === 403
              ? 'Você não tem permissão para esta ação.'
              : 'Verifique os dados e tente novamente.',
    );
  }
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/access' + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new AccessError(response.status);
  return response.json();
}
const message = (error: unknown) =>
  error instanceof AccessError
    ? error.message
    : 'Não foi possível conectar. Tente novamente.';

export function Access({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  async function session() {
    const data = await api<{ user: User }>('/session');
    setUser(data.user);
  }
  useEffect(() => {
    let active = true;
    api<{ user: User }>('/session')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch((e) => {
        if (active && !(e instanceof AccessError && e.status === 401))
          setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/login', { email, password });
      await session();
    } catch (e) {
      setError(message(e));
    } finally {
      setPassword('');
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/logout', {});
      setUser(null);
    } catch (e) {
      if (e instanceof AccessError && e.status === 401) setUser(null);
      else setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const expired = () => {
    setUser(null);
    setError('Sua sessão expirou. Entre novamente.');
  };
  if (loading)
    return (
      <main className="access-card" role="status">
        Verificando sessão…
      </main>
    );
  if (!user)
    return (
      <main className="access-card">
        <img className="access-logo" src={logo} alt="Fase Sport" />
        <h1>Entrar no FaseMarketplace</h1>
        <p>Acesso ao piloto • usuários autorizados</p>
        <form onSubmit={login}>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              maxLength={254}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="access-link"
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            {show ? 'Ocultar senha' : 'Mostrar senha'}
          </button>
          {error && <p role="alert">{error}</p>}
          <button className="access-primary" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="access-hint">
          O acesso é criado pelo administrador. Para recuperar o acesso, entre
          em contato com ele.
        </p>
      </main>
    );
  return <AccessActionsContext.Provider value={{logout,refresh:session,busy}}>
    <AccessExpiredContext.Provider value={expired}>
      <AccessUserContext.Provider value={user}>
        <div className="access-shell">
          {error&&<p className="access-banner" role="alert">{error}</p>}
          {user.mustChangePassword?<><PasswordChange mandatory expired={expired} done={session}/><div className="access-pending-exit"><button className="inv-btn inv-btn-secondary" disabled={busy} onClick={()=>void logout()}>Sair</button></div></>:children}
        </div>
      </AccessUserContext.Provider>
    </AccessExpiredContext.Provider>
  </AccessActionsContext.Provider>;
}

export function AccessSettings(){
  const user=useAccessUser(),actions=useAccessActions(),expired=useAccessExpired();
  const [createOpen,setCreateOpen]=useState(false);
  if(!user||!actions||!expired)return <p>Entre no sistema para configurar seu acesso.</p>;
  return <div className="access-settings">
    <div className="inv-page-header"><div><div className="inv-page-pretitle">ADMINISTRAÇÃO</div><h1 className="inv-page-title">Usuários</h1><p className="inv-page-desc">{user.role==='admin'?'Cadastre e gerencie os integrantes da equipe.':'Gerencie sua conta e sua senha de acesso.'}</p></div>
      {user.role==='admin'&&<button className="inv-btn inv-btn-primary" onClick={()=>setCreateOpen(true)}>Cadastrar usuário</button>}</div>
    {user.role==='admin'?<Users current={user} expired={expired} createOpen={createOpen} closeCreate={()=>setCreateOpen(false)}/>:<section className="access-own-account"><h2>Minha conta</h2><strong>{user.name}</strong><p>{user.email}</p><p>Usuário · acesso de consulta</p></section>}
    <details className="access-password-settings"><summary>Segurança da conta</summary><PasswordChange mandatory={false} expired={expired} done={actions.refresh}/></details>
  </div>;
}

function PasswordChange({
  mandatory,
  done,
  expired,
}: {
  mandatory: boolean;
  done: () => Promise<void>;
  expired: () => void;
}) {
  const [current, setCurrent] = useState(''),
    [next, setNext] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (next !== confirmation) {
      setError('A confirmação da nova senha não confere.');
      return;
    }
    if (current === next) {
      setError('Escolha uma senha diferente da atual.');
      return;
    }
    setBusy(true);
    try {
      await api('/password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirmation('');
      await done();
    } catch (e) {
      if (e instanceof AccessError && e.status === 401) expired();
      else setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="access-card">
      <h1>{mandatory ? 'Troque sua senha provisória' : 'Trocar senha'}</h1>
      <p>
        {mandatory
          ? 'Defina sua senha antes de continuar.'
          : 'As outras sessões serão encerradas.'}
      </p>
      <form onSubmit={submit}>
        <label>
          Senha atual
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          Nova senha
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label>
          Confirmar nova senha
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <p className="access-hint">
          Use entre 12 e 128 caracteres. Espaços são permitidos.
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="access-primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </main>
  );
}

function Users({ current, expired, createOpen, closeCreate }: { current: User; expired: () => void; createOpen: boolean; closeCreate: () => void }) {
  const [users, setUsers] = useState<User[]>([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [version, setVersion] = useState(0),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [role, setRole] = useState<'admin' | 'user'>('user'),
    [reset, setReset] = useState<User | null>(null),
    [resetPassword, setResetPassword] = useState(''),
    [search,setSearch]=useState(''),[loadedKey,setLoadedKey]=useState('');
  const requestKey=offset+':'+version,loading=loadedKey!==requestKey;
  useEffect(() => {
    let active = true;
    api<{ users: User[]; total: number }>('/users?offset=' + offset)
      .then((data) => {
        if (active) {
          setError('');setUsers(data.users);
          setTotal(data.total);
        }
      })
      .catch((e) => {
        if (active) {
          if (e instanceof AccessError && e.status === 401) expired();
          else setError(message(e));
        }
      }).finally(()=>{if(active)setLoadedKey(requestKey);});
    return () => {active=false;};
  }, [offset, version, requestKey, expired]);
  async function action(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(success);
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      if (e instanceof AccessError && e.status === 401) expired();
      else setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function cancelCreate() {
    if(busy)return;
    setName('');setEmail('');setPassword('');setRole('user');setError('');closeCreate();
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    const ok = await action(
      () => api('/users', { name, email, password, role }),
      'Usuário criado. Entregue a senha provisória por um canal privado; a troca será obrigatória.',
    );
    setPassword('');
    if (ok) {
      setName('');
      setEmail('');
      setRole('user');
      closeCreate();
    }
  }
  return (
    <div className="access-users">
      {error && !createOpen && !reset && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {createOpen&&<Dialog title="Novo usuário" busy={busy} onClose={cancelCreate}>
        <p className="access-hint">A senha inicial será fornecida pelo administrador. A troca será obrigatória no primeiro acesso.</p>
        {error&&<p role="alert">{error}</p>}
        <form className="access-grid" onSubmit={create}>
          <label>
            Nome
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Papel
            <select aria-label="Papel"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label>
            Senha provisória
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="access-primary" disabled={busy}>
            Cadastrar usuário
          </button>
          <button type="button" className="access-secondary" disabled={busy} onClick={cancelCreate}>Cancelar</button>
        </form>
      </Dialog>}
      <section>
        <h2>Equipe ({total})</h2>
        <label className="access-search">Pesquisar nesta página<input placeholder="Nome ou e-mail do usuário" value={search} onChange={event=>setSearch(event.target.value)}/></label>
        {loading?<p role="status">Carregando equipe…</p>:<div className="access-team">
          {users.filter(user=>(user.name+' '+user.email).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(user=><article className="access-member" key={user.id}>
            <div><strong>{user.name}</strong><span>{user.email}</span><small>{user.role==='admin'?'Administrador':'Usuário'} · {user.banned?'Bloqueado':user.mustChangePassword?'Troca de senha pendente':'Ativo'}</small></div>
            {user.id!==current.id&&<div className="access-actions"><button disabled={busy} onClick={()=>{if(window.confirm((user.banned?'Desbloquear':'Bloquear')+' este usuário?'))void action(()=>api('/users/'+user.id+'/block',{blocked:!user.banned}),'Acesso atualizado.');}}>{user.banned?'Desbloquear':'Bloquear'}</button>
              <button disabled={busy} onClick={()=>{setReset(user);setResetPassword('');}}>Redefinir senha</button></div>}
          </article>)}
          {!error&&!users.some(user=>(user.name+' '+user.email).toLocaleLowerCase().includes(search.toLocaleLowerCase()))&&<p>Nenhum usuário encontrado nesta página.</p>}
        </div>}
        <div className="access-pagination">
          <button
            disabled={busy || offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Anterior
          </button>
          <span>
            {total ? offset + 1 : 0}–{Math.min(offset + 20, total)} de {total}
          </span>
          <button
            disabled={busy || offset + 20 >= total}
            onClick={() => setOffset(offset + 20)}
          >
            Próxima
          </button>
        </div>
      </section>
      {reset && (
        <Dialog title={"Redefinir senha de "+reset.name} busy={busy} onClose={()=>{setReset(null);setResetPassword('');}}>
          {error&&<p role="alert">{error}</p>}
          <p>As sessões serão encerradas e a próxima entrada exigirá troca.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                !window.confirm(
                  'Encerrar sessões e redefinir a senha deste usuário?',
                )
              )
                return;
              const ok = await action(
                () =>
                  api('/users/' + reset.id + '/password', {
                    password: resetPassword,
                  }),
                'Senha redefinida. Entregue a senha provisória por um canal privado.',
              );
              setResetPassword('');
              if (ok) setReset(null);
            }}
          >
            <label>
              Nova senha provisória
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </label>
            <div className="access-actions">
              <button className="access-primary" disabled={busy}>
                Confirmar redefinição
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setReset(null);
                  setResetPassword('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
