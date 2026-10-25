import { createContext, useContext, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import logo from '../../../docs/assets/fase-sport-logo.svg';
import './access.css';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  mustChangePassword: boolean;
  banned: boolean;
};
const AccessUserContext = createContext<User | null>(null);
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
  const [admin, setAdmin] = useState(false),
    [changing, setChanging] = useState(false);
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
      setAdmin(false);
      setChanging(false);
    } catch (e) {
      if (e instanceof AccessError && e.status === 401) setUser(null);
      else setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const expired = () => {
    setUser(null);
    setAdmin(false);
    setChanging(false);
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
  return (
    <div className="access-shell">
      <header className="access-header">
        <img className="access-logo" src={logo} alt="Fase Sport" />
        <div>
          <strong>{user.name}</strong>
          <small>
            {user.role === 'admin' ? 'Administrador' : 'Usuário'} • ambiente
            do piloto
          </small>
        </div>
        <nav aria-label="Conta">
          <button
            onClick={() => {
              setAdmin(false);
              setChanging(false);
            }}
          >
            Início
          </button>
          {user.role === 'admin' && !user.mustChangePassword && (
            <button
              onClick={() => {
                setAdmin(true);
                setChanging(false);
              }}
            >
              Usuários
            </button>
          )}
          <button
            onClick={() => {
              setChanging(true);
              setAdmin(false);
            }}
          >
            Trocar senha
          </button>
          <button disabled={busy} onClick={() => void logout()}>
            Sair
          </button>
        </nav>
      </header>
      {error && (
        <p className="access-banner" role="alert">
          {error}
        </p>
      )}
      {user.mustChangePassword || changing ? (
        <PasswordChange
          mandatory={user.mustChangePassword}
          expired={expired}
          done={async () => {
            await session();
            setChanging(false);
          }}
        />
      ) : admin && user.role === 'admin' ? (
        <Users current={user} expired={expired} />
      ) : (
        <AccessUserContext.Provider value={user}>{children}</AccessUserContext.Provider>
      )}
    </div>
  );
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

function Users({ current, expired }: { current: User; expired: () => void }) {
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
    [resetPassword, setResetPassword] = useState('');
  useEffect(() => {
    let active = true;
    api<{ users: User[]; total: number }>('/users?offset=' + offset)
      .then((data) => {
        if (active) {
          setUsers(data.users);
          setTotal(data.total);
        }
      })
      .catch((e) => {
        if (active) {
          if (e instanceof AccessError && e.status === 401) expired();
          else setError(message(e));
        }
      });
    return () => {
      active = false;
    };
  }, [offset, version, expired]);
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
    }
  }
  return (
    <main className="access-users">
      <h1>Usuários</h1>
      <p>Somente administradores podem criar, bloquear ou recuperar acessos.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section>
        <h2>Criar usuário</h2>
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
            Perfil
            <select
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
            Criar usuário
          </button>
        </form>
      </section>
      <section>
        <h2>Acessos ({total})</h2>
        <div className="access-table">
          <table>
            <thead>
              <tr>
                <th>Nome / e-mail</th>
                <th>Perfil</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.name}
                    <small>{user.email}</small>
                  </td>
                  <td>{user.role === 'admin' ? 'Administrador' : 'Usuário'}</td>
                  <td>
                    {user.banned
                      ? 'Bloqueado'
                      : user.mustChangePassword
                        ? 'Troca de senha pendente'
                        : 'Ativo'}
                  </td>
                  <td>
                    <button
                      disabled={busy || user.id === current.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            (user.banned ? 'Desbloquear' : 'Bloquear') +
                              ' este usuário?',
                          )
                        )
                          void action(
                            () =>
                              api('/users/' + user.id + '/block', {
                                blocked: !user.banned,
                              }),
                            'Acesso atualizado.',
                          );
                      }}
                    >
                      {user.banned ? 'Desbloquear' : 'Bloquear'}
                    </button>
                    <button
                      disabled={busy || user.id === current.id}
                      onClick={() => {
                        setReset(user);
                        setResetPassword('');
                      }}
                    >
                      Redefinir senha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <section>
          <h2>Redefinir senha de {reset.name}</h2>
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
                onClick={() => {
                  setReset(null);
                  setResetPassword('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
