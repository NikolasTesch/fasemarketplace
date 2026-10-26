import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const magic = Buffer.from('FMABK001');
export const MAX_ENVELOPE_BYTES = 64 * 1024 * 1024;
export const MAX_DUMP_BYTES = 32 * 1024 * 1024;

export function readBackupKey(env = process.env) {
  const value = env.ACCESS_BACKUP_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(value) || ['AUTH_SECRET', 'AUTH_API_KEY', 'PREVIEW_AUTH_SECRET', 'PREVIEW_ACCESS_BRIDGE_KEY', 'PREVIEW_ACCESS_API_KEY']
    .some(name => env[name]?.toLowerCase() === value.toLowerCase())) throw new Error('Independent 32-byte backup key required');
  for (const name of ['DATABASE_URL', 'AUTH_DATABASE_URL', 'PREVIEW_AUTH_DATABASE_URL', 'PREVIEW_AUTH_OWNER_DATABASE_URL',
    'BUSINESS_DATABASE_URL', 'BUSINESS_MIGRATION_DATABASE_URL', 'BUSINESS_SHADOW_DATABASE_URL', 'BUSINESS_ADMIN_DATABASE_URL']) {
    if (env[name] && decodeURIComponent(new URL(env[name]).password).toLowerCase() === value.toLowerCase())
      throw new Error('Backup key must differ from database credentials');
  }
  return Buffer.from(value, 'hex');
}

export function sealBackup(payload, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid backup key');
  const plain = Buffer.from(JSON.stringify(payload));
  if (plain.length > MAX_ENVELOPE_BYTES - 36) throw new Error('Backup exceeds memory limit');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(magic);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([magic, nonce, cipher.getAuthTag(), ciphertext]);
}

export function openBackup(bytes, key) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 37 || bytes.length > MAX_ENVELOPE_BYTES || !bytes.subarray(0, 8).equals(magic))
    throw new Error('Invalid backup envelope');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(8, 20));
  decipher.setAAD(magic);
  decipher.setAuthTag(bytes.subarray(20, 36));
  // Do not release any plaintext to parsers, files or PostgreSQL until final authenticates it.
  const plain = Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}
