import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import type { Request, Response } from 'express';
import { readAccessConfig } from './config.js';
import { createAccessAuth } from './auth.js';
import { verifiedClientAddress } from './transport.js';

export type AccessUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  mustChangePassword: boolean;
  banned: boolean;
};
const userColumns =
  'id, name, email, role, "mustChangePassword", coalesce(banned,false) as banned';
const reserve = `local a=tonumber(redis.call('GET',KEYS[1]) or '0');local b=tonumber(redis.call('GET',KEYS[2]) or '0');if a>=5 or b>=20 then return 0 end;for i=1,2 do local n=redis.call('INCR',KEYS[i]);if n==1 then redis.call('EXPIRE',KEYS[i],900) end end;return 1`;

@Injectable()
export class LocalAccessService implements OnModuleDestroy {
  readonly config = readAccessConfig()!;
  readonly pool = new Pool({
    connectionString: this.config.databaseUrl,
    max: 4,
    connectionTimeoutMillis: this.config.connectionTimeoutMs,
    query_timeout: 3000,
  });
  private readonly lockPool = new Pool({
    connectionString: this.config.databaseUrl,
    max: 2,
    connectionTimeoutMillis: this.config.connectionTimeoutMs,
    query_timeout: 10000,
  });
  readonly auth = createAccessAuth(this.pool, this.config);
  private readonly redis = new Redis(this.config.redisUrl, {
    connectTimeout: 2000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  constructor() {
    this.redis.on('error', () => {
      /* Credentials/driver errors are deliberately not logged. */
    });
    this.pool.on('error', () => {});
    this.lockPool.on('error', () => {});
  }

  headers(request: Request) {
    const headers = new Headers();
    if (request.headers.cookie) headers.set('cookie', request.headers.cookie);
    // This server API wrapper has already checked the actual browser Origin.
    headers.set('origin', this.config.origin);
    return headers;
  }

  assertOrigin(request: Request) {
    if (
      request.headers.origin !== this.config.origin ||
      request.headers['sec-fetch-site'] === 'cross-site'
    )
      throw new ForbiddenException('Origem recusada');
    if (!request.is('application/json'))
      throw new HttpException('Conteúdo recusado', 415);
  }

  object(value: unknown, keys: string[]) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !keys.includes(key))
    )
      throw new BadRequestException('Dados inválidos');
    return value as Record<string, unknown>;
  }
  password(value: unknown) {
    if (typeof value !== 'string' || value.length < 12 || value.length > 128)
      throw new BadRequestException(
        'A senha deve ter entre 12 e 128 caracteres',
      );
    return value;
  }
  email(value: unknown) {
    if (
      typeof value !== 'string' ||
      value.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    )
      throw new BadRequestException('E-mail inválido');
    return value.trim().toLowerCase();
  }
  dto(user: AccessUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      banned: user.banned,
    };
  }
  async principal(request: Request, allowPending = false, admin = false) {
    verifiedClientAddress(this.config, request);
    let session;
    try {
      const result = await this.auth.api.getSession({
        headers: this.headers(request),
        asResponse: true,
      });
      if (result.status >= 500) throw new Error();
      session = await result.json();
      if (request.res) this.copyCookies(result, request.res);
    } catch {
      throw new ServiceUnavailableException(
        'Acesso temporariamente indisponível',
      );
    }
    if (!session)
      throw new UnauthorizedException('Sessão inválida ou expirada');
    const user = (
      await this.pool.query<AccessUser>(
        `SELECT ${userColumns} FROM auth_user WHERE id=$1`,
        [session.user.id],
      )
    ).rows[0];
    if (!user || user.banned || !['admin', 'user'].includes(user.role))
      throw new UnauthorizedException('Sessão inválida ou expirada');
    if (!allowPending && user.mustChangePassword)
      throw new ForbiddenException('Troque a senha provisória para continuar');
    if (admin && user.role !== 'admin')
      throw new ForbiddenException('Acesso restrito ao administrador');
    return { user, expiresAt: session.session.expiresAt };
  }
  copyCookies(result: globalThis.Response, response: Response) {
    for (const value of result.headers.getSetCookie())
      response.append('set-cookie', value);
  }

  async login(request: Request, response: Response, input: unknown) {
    const ip = verifiedClientAddress(this.config, request);
    this.assertOrigin(request);
    const body = this.object(input, ['email', 'password']);
    const email = this.email(body.email);
    if (typeof body.password !== 'string' || body.password.length > 128)
      throw new UnauthorizedException('Credenciais inválidas');
    const password = body.password;
    const key = (value: string) =>
      createHmac('sha256', this.config.secret).update(value).digest('hex');
    const keys = [
      `fm:access:${this.config.cookiePrefix}:login:${key(ip + '\0' + email)}`,
      `fm:access:${this.config.cookiePrefix}:ip:${key(ip)}`,
    ];
    try {
      if (Number(await this.redis.eval(reserve, 2, ...keys)) !== 1)
        throw new HttpException('Aguarde antes de tentar novamente', 429);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Login temporariamente indisponível',
      );
    }
    // Password verification and session creation must not straddle revocation.
    return this.exclusive(async () => {
      let result: globalThis.Response;
      try {
        result = await this.auth.api.signInEmail({
          body: { email, password, rememberMe: true },
          headers: this.headers(request),
          asResponse: true,
        });
      } catch {
        throw new UnauthorizedException('Credenciais inválidas');
      }
      if (!result.ok) throw new UnauthorizedException('Credenciais inválidas');
      const data = await result.json();
      const user = (
        await this.pool.query<AccessUser>(
          `SELECT ${userColumns} FROM auth_user WHERE id=$1`,
          [data.user.id],
        )
      ).rows[0];
      if (!user || user.banned)
        throw new UnauthorizedException('Credenciais inválidas');
      try {
        await this.redis.eval(
          "redis.call('DEL',KEYS[1]);if tonumber(redis.call('GET',KEYS[2]) or '0')>0 then redis.call('DECR',KEYS[2]) end;return 1",
          2,
          ...keys,
        );
      } catch {
        throw new ServiceUnavailableException(
          'Login temporariamente indisponível',
        );
      }
      this.copyCookies(result, response);
      return { user: this.dto(user) };
    });
  }

  async session(request: Request) {
    const { user, expiresAt } = await this.principal(request, true);
    return { user: this.dto(user), expiresAt };
  }
  async logout(request: Request, response: Response) {
    this.assertOrigin(request);
    const result = await this.auth.api.signOut({
      headers: this.headers(request),
      asResponse: true,
    });
    if (!result.ok) throw new UnauthorizedException('Sessão inválida');
    this.copyCookies(result, response);
    return { success: true };
  }

  // Dedicated pool prevents waiting advisory locks from starving Better Auth's pool.
  async exclusive<T>(work: () => Promise<T>) {
    const client = await this.lockPool.connect();
    let discard = false;
    try {
      // An explicit transaction pins the PgBouncer backend until COMMIT.
      // Session locks cannot safely be paired across pooled Neon queries.
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='8s'");
      await client.query('SELECT pg_advisory_xact_lock(734007)');
      const result = await work();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => { discard = true; });
      throw error;
    } finally {
      client.release(discard);
    }
  }
  async changePassword(request: Request, response: Response, input: unknown) {
    this.assertOrigin(request);
    const body = this.object(input, ['currentPassword', 'newPassword']);
    const newPassword = this.password(body.newPassword);
    if (
      typeof body.currentPassword !== 'string' ||
      body.currentPassword.length > 128 ||
      body.currentPassword === newPassword
    )
      throw new BadRequestException(
        'Informe a senha atual e uma nova senha diferente',
      );
    return this.exclusive(async () => {
      const { user } = await this.principal(request, true);
      let result;
      try {
        result = await this.auth.api.changePassword({
          body: {
            currentPassword: body.currentPassword as string,
            newPassword,
            revokeOtherSessions: true,
          },
          headers: this.headers(request),
          asResponse: true,
        });
      } catch {
        throw new BadRequestException('Não foi possível trocar a senha');
      }
      if (!result.ok)
        throw new BadRequestException('Não foi possível trocar a senha');
      await this.pool.query(
        'UPDATE auth_user SET "mustChangePassword"=false WHERE id=$1',
        [user.id],
      );
      this.copyCookies(result, response);
      return { success: true };
    });
  }

  async list(request: Request, offset: number) {
    await this.principal(request, false, true);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
      throw new BadRequestException('Página inválida');
    const result = await this.pool.query<AccessUser>(
      `SELECT ${userColumns} FROM auth_user ORDER BY "createdAt",id LIMIT 20 OFFSET $1`,
      [offset],
    );
    const total = Number(
      (await this.pool.query('SELECT count(*) FROM auth_user')).rows[0].count,
    );
    return {
      users: result.rows.map((user) => this.dto(user)),
      total,
      offset,
      limit: 20,
    };
  }
  async create(request: Request, input: unknown) {
    this.assertOrigin(request);
    const body = this.object(input, ['name', 'email', 'password', 'role']);
    const email = this.email(body.email),
      password = this.password(body.password);
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 100 ||
      !['admin', 'user'].includes(String(body.role))
    )
      throw new BadRequestException('Dados inválidos');
    return this.exclusive(async () => {
      await this.principal(request, false, true);
      if (
        (
          await this.pool.query('SELECT 1 FROM auth_user WHERE email=$1', [
            email,
          ])
        ).rowCount
      )
        throw new BadRequestException('E-mail já cadastrado');
      try {
        const result = await this.auth.api.createUser({
          body: {
            email,
            password,
            name: (body.name as string).trim(),
            role: body.role as 'admin' | 'user',
            data: { mustChangePassword: true },
          },
          headers: this.headers(request),
        });
        const created = (
          await this.pool.query<AccessUser>(
            `SELECT ${userColumns} FROM auth_user WHERE id=$1`,
            [result.user.id],
          )
        ).rows[0];
        return { user: this.dto(created!) };
      } catch {
        throw new BadRequestException('Não foi possível criar o usuário');
      }
    });
  }
  async block(request: Request, id: string, input: unknown) {
    this.assertOrigin(request);
    const body = this.object(input, ['blocked']);
    if (typeof body.blocked !== 'boolean')
      throw new BadRequestException('Dados inválidos');
    return this.exclusive(async () => {
      const { user: acting } = await this.principal(request, false, true);
      const target = (
        await this.pool.query<AccessUser>(
          `SELECT ${userColumns} FROM auth_user WHERE id=$1`,
          [id],
        )
      ).rows[0];
      if (!target) throw new BadRequestException('Usuário não encontrado');
      if (body.blocked && target.id === acting.id)
        throw new BadRequestException(
          'Não é permitido bloquear o próprio acesso',
        );
      if (body.blocked && target.role === 'admin' && !target.banned) {
        const count = Number(
          (
            await this.pool.query(
              "SELECT count(*) FROM auth_user WHERE role='admin' AND coalesce(banned,false)=false",
            )
          ).rows[0].count,
        );
        if (count <= 1)
          throw new BadRequestException(
            'É necessário manter um administrador ativo',
          );
      }
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'UPDATE auth_user SET banned=$1,"banExpires"=NULL WHERE id=$2',
          [body.blocked, id],
        );
        if (body.blocked)
          await client.query('DELETE FROM auth_session WHERE "userId"=$1', [
            id,
          ]);
        await client.query('COMMIT');
      } catch {
        await client.query('ROLLBACK');
        throw new ServiceUnavailableException(
          'Não foi possível atualizar o acesso',
        );
      } finally {
        client.release();
      }
      return { success: true };
    });
  }
  async resetPassword(request: Request, id: string, input: unknown) {
    this.assertOrigin(request);
    const body = this.object(input, ['password']);
    const newPassword = this.password(body.password);
    return this.exclusive(async () => {
      const { user } = await this.principal(request, false, true);
      if (id === user.id)
        throw new BadRequestException('Use a troca da própria senha');
      const mark = async () => {
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          const result = await client.query(
            'UPDATE auth_user SET "mustChangePassword"=true WHERE id=$1',
            [id],
          );
          if (!result.rowCount)
            throw new BadRequestException('Usuário não encontrado');
          await client.query('DELETE FROM auth_session WHERE "userId"=$1', [
            id,
          ]);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      };
      await mark();
      try {
        await this.auth.api.setUserPassword({
          body: { userId: id, newPassword },
          headers: this.headers(request),
        });
      } catch {
        throw new BadRequestException('Não foi possível redefinir a senha');
      }
      await mark();
      return { success: true };
    });
  }
  async onModuleDestroy() {
    this.redis.disconnect();
    await Promise.all([this.pool.end(), this.lockPool.end()]);
  }
}
