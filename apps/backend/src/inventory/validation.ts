import { BadRequestException, ConflictException } from '@nestjs/common';

export type InventoryModeName = 'SHARED' | 'SEPARATE';
export type InventoryBucketName = 'PHYSICAL_RESERVE' | 'SHARED_CHANNEL' | 'SHOPEE' | 'MERCADO_LIVRE';
export type InventoryMovementName = 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'TRANSFER';

const buckets: InventoryBucketName[] = ['PHYSICAL_RESERVE','SHARED_CHANNEL','SHOPEE','MERCADO_LIVRE'];
const invalid = (): never => { throw new BadRequestException('Dados de estoque inválidos'); };

function object(input: unknown, allowed: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) return invalid();
  return input as Record<string, unknown>;
}

function integer(value: unknown, min: number, max = 2147483647) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return invalid();
  return value;
}

function text(value: unknown, max: number): string;
function text(value: unknown, max: number, optional: true): string | undefined;
function text(value: unknown, max: number, optional = false): string | undefined {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string') return invalid();
  const result = value.trim();
  if (!result || result.length > max || [...result].some(char => {
    const code = char.charCodeAt(0);
    return code === 0 || code < 32 || code === 127;
  })) return invalid();
  return result;
}

export function inventoryId(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) return invalid();
  return value.toLowerCase();
}

export function inventoryQuery(input: unknown) {
  const data = object(input,['offset','search','variantId']);
  const rawOffset = data.offset === undefined ? '0' : data.offset;
  if (typeof rawOffset !== 'string' || !/^\d{1,6}$/.test(rawOffset) || Number(rawOffset) > 100000) return invalid();
  const search = data.search === undefined || data.search === '' ? '' : text(data.search,80);
  return {offset:Number(rawOffset),search,variantId:data.variantId === undefined ? undefined : inventoryId(data.variantId)};
}

export function inventoryModeInput(input: unknown) {
  const data = object(input,['mode','version']);
  if (data.mode !== 'SHARED' && data.mode !== 'SEPARATE') return invalid();
  return {mode:data.mode as InventoryModeName,version:integer(data.version,1)};
}

export function stockPolicyInput(input: unknown) {
  const data = object(input,['minimumQuantity','version']);
  return {minimumQuantity:integer(data.minimumQuantity,0),version:data.version === undefined ? undefined : integer(data.version,1)};
}

function bucket(value: unknown, optional = false): InventoryBucketName | null {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== 'string' || !buckets.includes(value as InventoryBucketName)) return invalid();
  return value as InventoryBucketName;
}

function bucketAllowed(value: InventoryBucketName, mode: InventoryModeName) {
  if (value === 'PHYSICAL_RESERVE') return true;
  return mode === 'SHARED' ? value === 'SHARED_CHANNEL' : value === 'SHOPEE' || value === 'MERCADO_LIVRE';
}

export interface InventoryMovementInput {
  variantId: string;
  movementType: InventoryMovementName;
  sourceBucket: InventoryBucketName | null;
  destinationBucket: InventoryBucketName | null;
  quantity: number;
  reason?: string;
  idempotencyKey: string;
}

export function inventoryMovementInput(input: unknown, mode: InventoryModeName): InventoryMovementInput {
  const data = object(input,['variantId','type','sourceBucket','destinationBucket','quantity','reason','idempotencyKey']);
  const variantId = inventoryId(data.variantId);
  const type = data.type;
  if (type !== 'INBOUND' && type !== 'OUTBOUND' && type !== 'ADJUSTMENT' && type !== 'TRANSFER') return invalid();
  const sourceBucket = bucket(data.sourceBucket,true), destinationBucket = bucket(data.destinationBucket,true);
  if ([sourceBucket,destinationBucket].some(value => value && !bucketAllowed(value,mode))) return invalid();
  const quantity = integer(data.quantity,1);
  const reason = data.reason === undefined ? undefined : text(data.reason,500);
  const idempotencyKey = text(data.idempotencyKey,160);

  if (type === 'INBOUND' && (sourceBucket !== null || destinationBucket !== 'PHYSICAL_RESERVE')) return invalid();
  if (type === 'OUTBOUND' && (!sourceBucket || destinationBucket !== null || !reason)) return invalid();
  if (type === 'ADJUSTMENT' && ((sourceBucket === null) === (destinationBucket === null) || !reason)) return invalid();
  if (type === 'TRANSFER' && (!sourceBucket || !destinationBucket || sourceBucket === destinationBucket)) return invalid();

  return {variantId,movementType:type,sourceBucket,destinationBucket,quantity,reason,idempotencyKey};
}

export interface BucketMovement {
  sourceBucket: InventoryBucketName | null;
  destinationBucket: InventoryBucketName | null;
  quantity: number;
}

export type BucketBalances = Record<InventoryBucketName, number>;

export function bucketBalances(movements: readonly BucketMovement[]): BucketBalances {
  const balances: BucketBalances = {PHYSICAL_RESERVE:0,SHARED_CHANNEL:0,SHOPEE:0,MERCADO_LIVRE:0};
  for (const movement of movements) {
    if (movement.destinationBucket) balances[movement.destinationBucket] += movement.quantity;
    if (movement.sourceBucket) balances[movement.sourceBucket] -= movement.quantity;
  }
  return balances;
}

export function projectStockBuckets(balances: BucketBalances, mode: InventoryModeName) {
  if (mode === 'SHARED' && (balances.SHOPEE !== 0 || balances.MERCADO_LIVRE !== 0))
    throw new ConflictException('Transfira os estoques individuais para a reserva antes de usar o modo compartilhado');
  if (mode === 'SEPARATE' && balances.SHARED_CHANNEL !== 0)
    throw new ConflictException('Transfira o estoque compartilhado para a reserva antes de separar os canais');
  return {
    physicalReserve:balances.PHYSICAL_RESERVE,
    sharedChannel:mode === 'SHARED' ? balances.SHARED_CHANNEL : null,
    shopee:mode === 'SEPARATE' ? balances.SHOPEE : null,
    mercadoLivre:mode === 'SEPARATE' ? balances.MERCADO_LIVRE : null,
    total:Object.values(balances).reduce((sum,quantity)=>sum+quantity,0),
  };
}

export function isBelowMinimum(total: number, minimum: number | null) {
  return minimum === null ? null : total <= minimum;
}
