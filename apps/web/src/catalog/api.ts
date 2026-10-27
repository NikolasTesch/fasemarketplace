export interface CatalogVariant {
  id: string; productId: string; name: string; sku: string; active: boolean; effectiveActive: boolean; version: number;
}
export interface CatalogProduct {
  id: string; name: string; description: string; iconName: string; salePrice: string|null; cost: string|null; active: boolean; version: number; createdAt: string;
  variantCount: number; variants: CatalogVariant[];
}
export interface CatalogPage {items: CatalogProduct[]; total: number; offset: number; limit: number;}
export class CatalogError extends Error {
  constructor(readonly status: number, sku = false) {
    super(status===409 ? (sku ? 'SKU já cadastrado. Escolha outro código.' : 'O cadastro mudou. Cancele a edição, recarregue e tente novamente.') :
      status===400 ? 'Confira os campos: nomes obrigatórios, SKU válido e limites do cadastro.' :
      status===413 ? 'Cadastro muito grande. Reduza a descrição ou a quantidade de variantes.' :
      status===401 || status===403 ? 'Seu acesso mudou. Entre novamente.' :
      'Catálogo indisponível. Tente novamente.');
  }
}
export async function catalogApi<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response=await fetch('/api/catalog'+path, {method:body===undefined?'GET':'POST', credentials:'same-origin',cache:'no-store',
    headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),
    signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(!response.ok){
    let sku=false;
    if(response.status===409){try{sku=(await response.json()).message==='SKU já cadastrado ou repetido';}catch{/* Generic conflict remains safe. */}}
    throw new CatalogError(response.status,sku);
  }
  return response.json();
}
export const catalogMessage=(error: unknown)=>error instanceof CatalogError?error.message:'Não foi possível conectar ao catálogo. Tente novamente.';
