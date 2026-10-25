import { Pool } from 'pg';
import { createInterface } from 'node:readline/promises';
import { readPreviewMaintenanceConfig } from '../apps/backend/dist/access/maintenance-config.js';
import { runPreviewMaintenance } from './auth-preview-operations.mjs';

async function privateInput(action) {
  if (process.argv.includes('--stdin')) {
    let raw = '';
    for await (const chunk of process.stdin) {
      raw += chunk.toString();
      if (raw.length > 8192) throw new Error('Input exceeds limit');
    }
    return JSON.parse(raw);
  }
  if (!process.stdin.isTTY) throw new Error('Private stdin requires --stdin');
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const name = action === 'bootstrap' ? await terminal.question('Nome: ') : undefined;
  const email = await terminal.question('E-mail: ');
  terminal.close();
  process.stdout.write('Senha provisória (não exibida): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const password = await new Promise((resolve, reject) => {
    let value = '';
    const receive = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === '\r' || char === '\n' || char === '\u0003') {
          process.stdin.off('data', receive);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          if (char === '\u0003') reject(new Error('Canceled')); else resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    process.stdin.on('data', receive);
  });
  return { name, email, password };
}

let ownerPool, runtimePool;
try {
  const config = readPreviewMaintenanceConfig(); // Before Pool or user input.
  const action = process.argv[2];
  if (!['check', 'migrate', 'bootstrap', 'recover'].includes(action)) throw new Error('Invalid operation');
  if (process.argv.some((arg, index) => index > 2 && arg !== '--stdin')) throw new Error('Credentials must not be arguments');
  if (action === 'check') {
    console.log('Preview development configuration validated. No database connection or write performed.');
  } else {
    const input = action === 'migrate' ? undefined : await privateInput(action);
    const options = { max: 3, connectionTimeoutMillis: config.connectionTimeoutMs, query_timeout: 30000 };
    ownerPool = new Pool({ ...options, connectionString: config.ownerUrl, max: 1,
      options: '-c search_path=public -c statement_timeout=30000 -c lock_timeout=10000' });
    runtimePool = new Pool({ ...options, connectionString: config.databaseUrl });
    ownerPool.on('error', () => {});
    runtimePool.on('error', () => {});
    const result = await runPreviewMaintenance({ action, ownerPool, runtimePool, config, input });
    console.log(JSON.stringify(result));
  }
} catch {
  console.error('Preview maintenance refused or failed. Verify target, role permissions, migration checksum and administrator state. No credential was logged.');
  process.exitCode = 1;
} finally {
  await Promise.allSettled([ownerPool?.end(), runtimePool?.end()]);
}
