import {BadRequestException, ConflictException} from '@nestjs/common';

function invalid(): never { throw new BadRequestException('Dados de catálogo inválidos'); }
function object(input: unknown, keys: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) return invalid();
  return input as Record<string, unknown>;
}
function text(value: unknown, max: number, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string') return invalid();
  const result = value.trim();
  const controls = [...result].some(char => char.charCodeAt(0) === 0 || (!optional && (char.charCodeAt(0)<32 || char.charCodeAt(0)===127)));
  if ((!optional && !result) || result.length > max || controls) return invalid();
  return result;
}
function version(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483646) return invalid();
  return value;
}
function active(value: unknown) { if (typeof value !== 'boolean') return invalid(); return value; }
function money(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return invalid();
  const [units, cents=''] = value.split('.');
  return `${units}.${cents.padEnd(2,'0')}`;
}
const productIcons = ['checkroom','sports','sports_soccer','water_bottle','sports_tennis','sprint','apparel','sports_basketball','sports_volleyball','fitness_center','pool','backpack','sports_martial_arts','sports_baseball','sports_football','sports_golf','sports_handball','sports_hockey','sports_rugby','sports_mma','sports_cricket','hiking','directions_bike','skateboarding','sports_gymnastics','product_cap','product_shorts','product_socks'] as const;
function iconName(value: unknown, optional = false) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !productIcons.includes(value as typeof productIcons[number])) return invalid();
  return value;
}
export function variantInput(input: unknown, withVersion = false) {
  const data = object(input, withVersion ? ['name','sku','version'] : ['name','sku']);
  const name = text(data.name, 100), sku = text(data.sku, 64).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(sku)) return invalid();
  return {name, sku, ...(withVersion ? {version:version(data.version)} : {})};
}
export function productInput(input: unknown) {
  const data = object(input, ['name','description','iconName','salePrice','cost','variants']);
  const name = text(data.name, 120), description = text(data.description, 2000);
  if (!Array.isArray(data.variants) || data.variants.length < 1 || data.variants.length > 20) return invalid();
  const variants = data.variants.map(item => variantInput(item));
  if (new Set(variants.map(item => item.sku)).size !== variants.length) throw new ConflictException('SKU já cadastrado ou repetido');
  return {name, description, iconName:iconName(data.iconName, true)??'sports_soccer',salePrice:money(data.salePrice),cost:money(data.cost),variants};
}
export function productEdit(input: unknown) {
  const data = object(input, ['name','description','iconName','salePrice','cost','active','version']);
  if ((data.salePrice===undefined)!==(data.cost===undefined)) return invalid();
  return {name:text(data.name,120), description:text(data.description,2000), ...(data.iconName===undefined?{}:{iconName:iconName(data.iconName)}),...(data.salePrice===undefined?{}:{salePrice:money(data.salePrice),cost:money(data.cost)}),active:active(data.active), version:version(data.version)};
}
export function variantEdit(input: unknown) {
  const data = object(input, ['name','active','version']);
  return {name:text(data.name,100), active:active(data.active), version:version(data.version)};
}
export function catalogId(value: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) return invalid();
  return value.toLowerCase();
}
export function catalogQuery(input: unknown) {
  const data = object(input,['offset','search','status']);
  const offset = data.offset === undefined ? '0' : data.offset;
  if (typeof offset !== 'string' || !/^\d{1,6}$/.test(offset) || Number(offset)>100000) return invalid();
  const search = text(data.search,80,true), status = data.status ?? 'all';
  if (status !== 'all' && status !== 'active' && status !== 'inactive') return invalid();
  return {offset:Number(offset), search, status};
}
