export type InventoryMode='SHARED'|'SEPARATE';
export type InventoryBucket='PHYSICAL_RESERVE'|'SHARED_CHANNEL'|'SHOPEE'|'MERCADO_LIVRE';
export interface StockItem {variantId:string;productId:string;productName:string;iconName:string;name:string;sku:string;physicalReserve:number;sharedChannel:number|null;shopee:number|null;mercadoLivre:number|null;total:number;minimumQuantity:number|null;minimumVersion:number|null;belowMinimum:boolean|null;}
export interface StockPage {items:StockItem[];total:number;offset:number;limit:number;mode:InventoryMode;}
export interface InventoryMovement {id:string;variantId:string;sku:string;variantName:string;productName:string;type:'OPENING'|'INBOUND'|'OUTBOUND'|'ADJUSTMENT'|'TRANSFER';sourceBucket:InventoryBucket|null;destinationBucket:InventoryBucket|null;quantity:number;reason:string|null;createdBy:string;createdAt:string;}
export interface MovementPage {items:InventoryMovement[];total:number;offset:number;limit:number;}
export interface InventorySettings {mode:InventoryMode;version:number;}
export class InventoryError extends Error {
  constructor(readonly status:number){super(status===400?'Confira os dados do lançamento e tente novamente.':status===401||status===403?'Seu acesso mudou. Entre novamente.':status===404?'O SKU não está disponível.':status===409?'O saldo, o lançamento ou a configuração mudou. Recarregue antes de continuar.':'Estoque indisponível. Tente novamente.');}
}
export async function inventoryApi<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch('/api/inventory'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(!response.ok)throw new InventoryError(response.status);return response.json();
}
export const inventoryMessage=(error:unknown)=>error instanceof InventoryError?error.message:'Não foi possível conectar ao estoque. Tente novamente.';
export const bucketLabel=(bucket:InventoryBucket|null)=>bucket===null?'—':({PHYSICAL_RESERVE:'Reserva física',SHARED_CHANNEL:'Compartilhado',SHOPEE:'Shopee',MERCADO_LIVRE:'Mercado Livre'} satisfies Record<InventoryBucket,string>)[bucket];
export const movementLabel=(type:InventoryMovement['type'])=>({OPENING:'Abertura',INBOUND:'Entrada',OUTBOUND:'Saída',ADJUSTMENT:'Ajuste',TRANSFER:'Transferência'}[type]);
