import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { readFile, mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBusinessMaintenanceConfig } from '../dist/persistence/config.js';
import { runBusinessMaintenance } from '../../../scripts/business-operations.mjs';

test('Prisma infrastructure only in disposable local databases, auth preserved', async t => {
  const base = new URL(process.env.DATABASE_URL);
  assert.equal(base.hostname, 'postgres');
  assert.equal(base.pathname, '/fm_auth_test_business');
  const admin = new Pool({ connectionString: base.href });
  const suffix = randomBytes(7).toString('hex');
  const database = 'fm_business_test_' + suffix;
  const shadow = 'fm_business_shadow_' + suffix;
  await admin.query(`CREATE DATABASE "${database}"`);
  await admin.query(`CREATE DATABASE "${shadow}"`);
  const url = (db, role, password) => {
    const value = new URL(base); value.pathname = '/' + db; value.username = role;
    value.password = password; value.search = '?schema=business'; return value.href;
  };
  const env = { ...process.env, BUSINESS_LOCAL_DATABASE: database,
    BUSINESS_DATABASE_URL: url(database, 'fm_business_runtime', process.env.BUSINESS_TEST_RUNTIME_PASSWORD),
    BUSINESS_MIGRATION_DATABASE_URL: url(database, 'fm_business_migrator', process.env.BUSINESS_TEST_MIGRATION_PASSWORD),
    BUSINESS_SHADOW_DATABASE_URL: url(shadow, 'fm_business_migrator', process.env.BUSINESS_TEST_MIGRATION_PASSWORD) };
  const config = readBusinessMaintenanceConfig(env);
  const ownerUrl = new URL(base); ownerUrl.pathname = '/' + database;
  const owner = new Pool({ connectionString: ownerUrl.href });
  const runtime = new Pool({ connectionString: config.runtimeUrl });
  const migrator = new Pool({ connectionString: config.migrationUrl });
  try {
    await owner.query('CREATE TABLE public.auth_probe(id integer PRIMARY KEY, value text NOT NULL)');
    await owner.query("INSERT INTO public.auth_probe VALUES(1,'preserve me')");
    await t.test('provision is repeatable without rotating credentials; migration only business', async () => {
      await runBusinessMaintenance({ action: 'provision', config, adminUrl: ownerUrl.href });
      await runBusinessMaintenance({ action: 'provision', config, adminUrl: ownerUrl.href });
      await runBusinessMaintenance({ action: 'migrate', config });
      await runBusinessMaintenance({ action: 'migrate', config });
      assert.equal((await owner.query('SELECT value FROM public.auth_probe')).rows[0].value, 'preserve me');
      assert.equal((await owner.query('SELECT count(*) FROM business._prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].count, '3');
      const inventory = await owner.query(`SELECT to_regclass('business.inventory_settings') AS settings,
        to_regclass('business.variant_stock_policy') AS policies,to_regclass('business.stock_movement') AS movements`);
      assert.deepEqual(Object.values(inventory.rows[0]).map(Boolean), [true,true,true]);
      assert.equal((await owner.query('SELECT mode FROM business.inventory_settings WHERE id=1')).rows[0].mode, 'SEPARATE');
      const now = new Date();
      const productId = randomUUID(), variantId = randomUUID();
      await owner.query(`INSERT INTO business.catalog_product(id,name,description,updated_at,created_by,updated_by)
        VALUES($1,'Inventory probe','', $2,'integration','integration')`, [productId,now]);
      await owner.query(`INSERT INTO business.catalog_variant(id,product_id,name,sku,updated_at,created_by,updated_by)
        VALUES($1,$2,'Default',$3,$4,'integration','integration')`, [variantId,productId,'INV-PROBE-'+suffix.slice(0,8).toUpperCase(),now]);
      await owner.query(`INSERT INTO business.variant_stock_policy(variant_id,minimum_quantity,updated_at,updated_by)
        VALUES($1,3,now(),'integration')`, [variantId]);
      const movement = {id:randomUUID(),variantId,key:'integration:'+suffix};
      await runtime.query(`INSERT INTO business.stock_movement(id,variant_id,movement_type,source_bucket,destination_bucket,quantity,reason,idempotency_key,created_by)
        VALUES($1,$2,'INBOUND',NULL,'PHYSICAL_RESERVE',10,'business integration',$3,'integration')`, [movement.id,movement.variantId,movement.key]);
      assert.equal((await runtime.query('SELECT quantity FROM business.stock_movement WHERE id=$1',[movement.id])).rows[0].quantity,10);
      await assert.rejects(runtime.query(`INSERT INTO business.stock_movement(id,variant_id,movement_type,source_bucket,destination_bucket,quantity,reason,idempotency_key,created_by)
        VALUES($1,$2,'INBOUND',NULL,'PHYSICAL_RESERVE',10,'duplicate',$3,'integration')`, [randomUUID(),movement.variantId,movement.key]), e=>e.code==='23505');
      await assert.rejects(runtime.query(`UPDATE business.stock_movement SET reason='changed' WHERE id=$1`,[movement.id]), e=>e.code==='42501');
      await assert.rejects(runtime.query(`DELETE FROM business.stock_movement WHERE id=$1`,[movement.id]), e=>e.code==='42501');
      await assert.rejects(owner.query(`INSERT INTO business.stock_movement(id,variant_id,movement_type,source_bucket,destination_bucket,quantity,reason,idempotency_key,created_by)
        VALUES($1,$2,'INBOUND',NULL,'PHYSICAL_RESERVE',0,'invalid',$3,'integration')`, [randomUUID(),variantId,'invalid:'+suffix]), e=>e.code==='23514');
    });
    await t.test('runtime cannot DDL, migration history, truncate or read auth; migrator cannot touch auth', async () => {
      for (const sql of ['CREATE TABLE business.forbidden(id int)', 'SELECT * FROM business._prisma_migrations',
        'SELECT * FROM public.auth_probe', 'TRUNCATE public.auth_probe'])
        await assert.rejects(runtime.query(sql), e => e.code === '42501');
      await assert.rejects(migrator.query('UPDATE public.auth_probe SET value=\'wrong\''), e => e.code === '42501');
      await assert.rejects(migrator.query('CREATE TABLE public.wrong(id int)'), e => e.code === '42501');
      await migrator.query('GRANT CREATE ON SCHEMA business TO fm_business_runtime');
      try { await assert.rejects(runBusinessMaintenance({ action: 'check', config }), /privileges/); }
      finally { await migrator.query('REVOKE CREATE ON SCHEMA business FROM fm_business_runtime'); }
    });
    await t.test('transaction rollback, constraints and concurrent migrations preserve durable facts', async () => {
      await migrator.query('CREATE TABLE business.fixture(id integer PRIMARY KEY, value integer CHECK(value>=0))');
      await migrator.query('GRANT SELECT,INSERT,UPDATE,DELETE ON business.fixture TO fm_business_runtime');
      await runtime.query('BEGIN'); await runtime.query('INSERT INTO business.fixture VALUES(1,7)');
      await assert.rejects(runtime.query('INSERT INTO business.fixture VALUES(2,-1)'), e => e.code === '23514');
      await runtime.query('ROLLBACK');
      assert.equal((await runtime.query('SELECT count(*) FROM business.fixture')).rows[0].count, '0');
      await runtime.query('INSERT INTO business.fixture VALUES(1,7)');
      await assert.rejects(runtime.query('TRUNCATE business.fixture'), e => e.code === '42501');
      await migrator.query('GRANT TRUNCATE ON business.fixture TO fm_business_runtime');
      try { await assert.rejects(runBusinessMaintenance({ action: 'check', config }), /privileges/); }
      finally { await migrator.query('REVOKE TRUNCATE ON business.fixture FROM fm_business_runtime'); }
      await Promise.all([runBusinessMaintenance({ action: 'migrate', config }), runBusinessMaintenance({ action: 'migrate', config })]);
      assert.equal((await runtime.query('SELECT value FROM business.fixture')).rows[0].value, 7);
    });
    await t.test('modified or absent applied migration and failed ledger refuse before execution', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'fm-migrations-'));
      const name = '202610260001_business_schema';
      await mkdir(join(directory, name));
      await writeFile(join(directory, name, 'migration.sql'), 'SELECT 1;');
      await assert.rejects(runBusinessMaintenance({ action: 'migrate', config, migrationsPath: directory }), /history/);
      const empty = await mkdtemp(join(tmpdir(), 'fm-migrations-empty-'));
      await assert.rejects(runBusinessMaintenance({ action: 'migrate', config, migrationsPath: empty }), /history/);
      await migrator.query("INSERT INTO business._prisma_migrations(id,checksum,migration_name,started_at) VALUES('failed','x','failed_fixture',now())");
      await assert.rejects(runBusinessMaintenance({ action: 'migrate', config }), /history/);
      // Only the synthetic row introduced by this test is removed.
      await migrator.query("DELETE FROM business._prisma_migrations WHERE id='failed'");
      assert.ok((await readFile('apps/backend/prisma/migrations/' + name + '/migration.sql', 'utf8')).includes('pg_namespace'));
    });
    await t.test('generated Prisma client uses limited role and rolls back a failed transaction', async () => {
      const { createBusinessClient } = await import('../dist/persistence/client.js');
      assert.equal(createBusinessClient({}), null);
      const client = createBusinessClient(env);
      try {
        await client.$connect();
        assert.equal((await client.$queryRaw`SELECT current_user AS name`)[0].name, 'fm_business_runtime');
        await assert.rejects(client.$transaction(async tx => {
          await tx.$executeRaw`INSERT INTO business.fixture VALUES(9,17)`;
          await tx.$executeRaw`INSERT INTO business.fixture VALUES(10,-1)`;
        }));
        assert.equal((await client.$queryRaw`SELECT count(*)::text AS count FROM business.fixture WHERE id=9`)[0].count, '0');
        await assert.rejects(client.$executeRaw`CREATE TABLE business.prisma_forbidden(id integer)`);
        await assert.rejects(client.$queryRaw`SELECT * FROM public.auth_probe`);
        const { assertBusinessRuntime } = await import('../dist/persistence/client.js');
        await assertBusinessRuntime(client);
        await owner.query('GRANT SELECT ON public.auth_probe TO fm_business_runtime');
        try { await assert.rejects(assertBusinessRuntime(client), /privileges/); }
        finally { await owner.query('REVOKE SELECT ON public.auth_probe FROM fm_business_runtime'); }
      } finally { await client.$disconnect(); }
    });
    await t.test('generation refuses a database containing auth or business fixtures', async () => {
      await assert.rejects(runBusinessMaintenance({ action: 'plan', config }), /generation/);
    });
    await t.test('generation executes only against fresh empty target and shadow', async () => {
      const db = 'fm_business_test_generate_' + suffix;
      const shadowDb = 'fm_business_shadow_generate_' + suffix;
      await admin.query(`CREATE DATABASE "${db}"`);
      await admin.query(`CREATE DATABASE "${shadowDb}"`);
      const isolated = readBusinessMaintenanceConfig({ ...env, BUSINESS_LOCAL_DATABASE: db,
        BUSINESS_DATABASE_URL: url(db, 'fm_business_runtime', process.env.BUSINESS_TEST_RUNTIME_PASSWORD),
        BUSINESS_MIGRATION_DATABASE_URL: url(db, 'fm_business_migrator', process.env.BUSINESS_TEST_MIGRATION_PASSWORD),
        BUSINESS_SHADOW_DATABASE_URL: url(shadowDb, 'fm_business_migrator', process.env.BUSINESS_TEST_MIGRATION_PASSWORD) });
      const isolatedAdmin = new URL(ownerUrl); isolatedAdmin.pathname = '/' + db;
      await runBusinessMaintenance({ action: 'provision', config: isolated, adminUrl: isolatedAdmin.href });
      const schemaFile = 'apps/backend/prisma/schema.prisma';
      const original = await readFile(schemaFile, 'utf8');
      const migrations = 'apps/backend/prisma/migrations';
      const before = await readdir(migrations);
      // Run this suite in its disposable image, never with the repository prisma
      // directory mounted: this model is an ephemeral generation fixture only.
      try {
        await writeFile(schemaFile, original + '\nmodel GenerationProbe {\n id Int @id\n @@schema("business")\n @@map("_generation_fixture")\n}\n');
        await runBusinessMaintenance({ action: 'plan', config: isolated });
        const created = (await readdir(migrations)).filter(name => !before.includes(name));
        assert.equal(created.length, 1);
        const sql = await readFile(join(migrations, created[0], 'migration.sql'), 'utf8');
        assert.match(sql, /CREATE TABLE ("business"\.)?"_generation_fixture"/);
        await runBusinessMaintenance({ action: 'migrate', config: isolated });
        const generatedPool = new Pool({ connectionString: isolated.migrationUrl });
        try {
          const names = (await generatedPool.query("SELECT to_regclass('business._generation_fixture') AS business, to_regclass('public._generation_fixture') AS public")).rows[0];
          assert.ok(names.business); assert.equal(names.public, null);
        } finally { await generatedPool.end(); }
        if (process.env.BUSINESS_TEST_PROOF_DIRECTORY) {
          await mkdir(process.env.BUSINESS_TEST_PROOF_DIRECTORY, { recursive: true });
          await writeFile(join(process.env.BUSINESS_TEST_PROOF_DIRECTORY, 'generated-' + suffix + '.sql'), sql, {flag:'wx',mode:0o600});
        }
      } finally { await writeFile(schemaFile, original); }
      // Source auth and business facts remain unchanged.
      assert.equal((await owner.query('SELECT value FROM public.auth_probe')).rows[0].value, 'preserve me');
      assert.equal((await runtime.query('SELECT value FROM business.fixture WHERE id=1')).rows[0].value, 7);
    });
  } finally { await Promise.all([admin.end(), owner.end(), runtime.end(), migrator.end()]); }
});
