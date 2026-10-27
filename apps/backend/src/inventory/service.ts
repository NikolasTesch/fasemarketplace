import {ConflictException,HttpException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import type {Request} from 'express';
import {Prisma} from '../generated/prisma/client.js';
import {LocalAccessService} from '../access/service.js';
import {BusinessPersistence} from '../persistence/module.js';
import {bucketBalances,inventoryId,inventoryModeInput,inventoryMovementInput,inventoryQuery,isBelowMinimum,projectStockBuckets,stockPolicyInput,type BucketMovement,type InventoryModeName,type InventoryBucketName} from './validation.js';

type BalanceRow={bucket:InventoryBucketName;quantity:number};
const unavailable=()=>new ServiceUnavailableException('Estoque temporariamente indisponível');
function failed(error: unknown): never {
  if(error instanceof HttpException) throw error;
  if(error instanceof Prisma.PrismaClientKnownRequestError){
    if(error.code==='P2002') throw new ConflictException('Movimento repetido ou cadastro alterado; recarregue antes de tentar novamente');
    if(error.code==='P2034'||error.code==='P2025') throw new ConflictException('O estoque mudou. Recarregue antes de tentar novamente');
  }
  throw unavailable();
}
function notFound(): never {throw new NotFoundException('SKU não encontrado');}

@Injectable()
export class InventoryService {
  constructor(@Inject(BusinessPersistence) private readonly persistence: BusinessPersistence,@Inject(LocalAccessService) private readonly access: LocalAccessService) {}
  private get db(){if(!this.persistence.client) throw unavailable();return this.persistence.client;}
  private async read<T>(req: Request,operation:()=>Promise<T>) {
    try{await this.access.principal(req);return await operation();}catch(error){return failed(error);}
  }
  private async write<T>(req: Request,admin: boolean,operation:(actor:string)=>Promise<T>) {
    try{
      this.access.assertOrigin(req);
      return await this.access.exclusive(async()=>{const {user}=await this.access.principal(req,false,admin);return operation(user.id);});
    }catch(error){return failed(error);}
  }
  async settings(req:Request){return this.read(req,async()=>{const row=await this.db.inventorySettings.findUnique({where:{id:1}});if(!row)throw unavailable();return {mode:row.mode,version:row.version};});}
  async stock(req:Request,input:unknown){return this.read(req,async()=>{
    const query=inventoryQuery(input),literal=query.search.replace(/[\\%_]/g,'\\$&');
    const where:Prisma.CatalogVariantWhereInput={active:true,product:{active:true},...(query.variantId?{id:query.variantId}:{}),...(literal?{OR:[{sku:{contains:literal,mode:'insensitive'}},{name:{contains:literal,mode:'insensitive'}},{product:{name:{contains:literal,mode:'insensitive'}}}]}:{})};
    const [total,variants,settings]=await Promise.all([
      this.db.catalogVariant.count({where}),
      this.db.catalogVariant.findMany({where,skip:query.offset,take:20,orderBy:[{sku:'asc'},{id:'asc'}],include:{product:{select:{name:true,iconName:true}},stockPolicy:true}}),
      this.db.inventorySettings.findUnique({where:{id:1}}),
    ]);
    if(!settings)throw unavailable();
    const [ledger]=await Promise.all([variants.length?this.db.stockMovement.findMany({where:{variantId:{in:variants.map(v=>v.id)}},select:{variantId:true,sourceBucket:true,destinationBucket:true,quantity:true}}):Promise.resolve([])]);
    const byVariant=new Map<string,BucketMovement[]>();
    for(const row of ledger){const rows=byVariant.get(row.variantId)??[];rows.push({sourceBucket:row.sourceBucket,destinationBucket:row.destinationBucket,quantity:row.quantity});byVariant.set(row.variantId,rows);}
    const mode=settings.mode;
    return {items:variants.map(v=>{const raw=bucketBalances(byVariant.get(v.id)??[]);const balances=projectStockBuckets(raw,mode);const minimum=v.stockPolicy?.minimumQuantity??null;
      return {variantId:v.id,productId:v.productId,productName:v.product.name,iconName:v.product.iconName,name:v.name,sku:v.sku,...balances,minimumQuantity:minimum,minimumVersion:v.stockPolicy?.version??null,belowMinimum:isBelowMinimum(balances.total,minimum)};
    }),total,offset:query.offset,limit:20,mode};
  });}
  async movements(req:Request,input:unknown){return this.read(req,async()=>{
    const query=inventoryQuery(input);const where=query.variantId?{variantId:query.variantId}:{};
    const [total,rows]=await Promise.all([this.db.stockMovement.count({where}),this.db.stockMovement.findMany({where,skip:query.offset,take:20,orderBy:[{createdAt:'desc'},{id:'desc'}],include:{variant:{select:{sku:true,name:true,product:{select:{name:true}}}}}})]);
    return {items:rows.map(row=>({id:row.id,variantId:row.variantId,sku:row.variant.sku,variantName:row.variant.name,productName:row.variant.product.name,type:row.movementType,sourceBucket:row.sourceBucket,destinationBucket:row.destinationBucket,quantity:row.quantity,reason:row.reason,createdBy:row.createdBy,createdAt:row.createdAt.toISOString()})),total,offset:query.offset,limit:20};
  });}
  createMovement(req:Request,body:unknown){return this.write(req,false,async actor=>{
    const initial=await this.db.inventorySettings.findUnique({where:{id:1}});if(!initial)throw unavailable();
    const input=inventoryMovementInput(body,initial.mode);
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM business.inventory_settings WHERE id=1 FOR SHARE`;
      const locked=await tx.$queryRaw<{mode:InventoryModeName}[]>`SELECT mode FROM business.inventory_settings WHERE id=1`;
      if(locked[0]?.mode!==initial.mode)throw new ConflictException('O modo de estoque mudou; recarregue antes de tentar novamente');
      const variants=await tx.$queryRaw<{id:string}[]>`SELECT v.id FROM business.catalog_variant v JOIN business.catalog_product p ON p.id=v.product_id WHERE v.id=${input.variantId}::uuid AND v.active=true AND p.active=true FOR UPDATE OF v,p`;
      if(!variants.length)throw new ConflictException('SKU inativo ou indisponível para movimentação');
      const ledger=await tx.stockMovement.findMany({where:{variantId:input.variantId},select:{sourceBucket:true,destinationBucket:true,quantity:true}});
      const balances=bucketBalances(ledger as BucketMovement[]);
      if(input.sourceBucket&&balances[input.sourceBucket]<input.quantity)throw new ConflictException('Saldo insuficiente no bucket de origem');
      const row=await tx.stockMovement.create({data:{variantId:input.variantId,movementType:input.movementType,sourceBucket:input.sourceBucket,destinationBucket:input.destinationBucket,quantity:input.quantity,reason:input.reason,idempotencyKey:input.idempotencyKey,createdBy:actor}});
      return {id:row.id,variantId:row.variantId,type:row.movementType,sourceBucket:row.sourceBucket,destinationBucket:row.destinationBucket,quantity:row.quantity,createdAt:row.createdAt.toISOString()};
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:15000});
  });}
  setMinimum(req:Request,value:string,body:unknown){return this.write(req,true,async actor=>{
    const id=inventoryId(value),input=stockPolicyInput(body);
    return this.db.$transaction(async tx=>{
      const variants=await tx.$queryRaw<{id:string}[]>`SELECT v.id FROM business.catalog_variant v JOIN business.catalog_product p ON p.id=v.product_id WHERE v.id=${id}::uuid AND v.active=true AND p.active=true FOR UPDATE OF v,p`;
      if(!variants.length)return notFound();
      const current=await tx.variantStockPolicy.findUnique({where:{variantId:id}});
      if(!current){if(input.version!==undefined)throw new ConflictException('Política alterada; recarregue antes de tentar novamente');
        const created=await tx.variantStockPolicy.create({data:{variantId:id,minimumQuantity:input.minimumQuantity,updatedBy:actor}});return {variantId:id,minimumQuantity:created.minimumQuantity,version:created.version};}
      if(input.version===undefined||current.version!==input.version)throw new ConflictException('Política alterada; recarregue antes de tentar novamente');
      const updated=await tx.variantStockPolicy.updateMany({where:{variantId:id,version:input.version},data:{minimumQuantity:input.minimumQuantity,version:{increment:1},updatedBy:actor}});
      if(!updated.count)throw new ConflictException('Política alterada; recarregue antes de tentar novamente');
      const result=await tx.variantStockPolicy.findUniqueOrThrow({where:{variantId:id}});return {variantId:id,minimumQuantity:result.minimumQuantity,version:result.version};
    });
  });}
  setMode(req:Request,body:unknown){return this.write(req,true,async actor=>{
    const input=inventoryModeInput(body);
    return this.db.$transaction(async tx=>{
      const rows=await tx.$queryRaw<{mode:InventoryModeName;version:number}[]>`SELECT mode, version FROM business.inventory_settings WHERE id=1 FOR UPDATE`;
      const current=rows[0];if(!current)throw unavailable();if(current.version!==input.version)throw new ConflictException('Configuração alterada; recarregue antes de tentar novamente');
      if(current.mode===input.mode)return {mode:current.mode,version:current.version};
      const grouped=await tx.$queryRaw<BalanceRow[]>`SELECT bucket, SUM(quantity)::int AS quantity FROM (
        SELECT destination_bucket AS bucket, quantity FROM business.stock_movement WHERE destination_bucket IS NOT NULL
        UNION ALL SELECT source_bucket AS bucket, -quantity AS quantity FROM business.stock_movement WHERE source_bucket IS NOT NULL
      ) movements GROUP BY bucket`;
      const balances=new Map(grouped.map(row=>[row.bucket,Number(row.quantity)]));
      const incompatible=input.mode==='SHARED'?['SHOPEE','MERCADO_LIVRE']:['SHARED_CHANNEL'];
      if(incompatible.some(bucket=>(balances.get(bucket as InventoryBucketName)??0)!==0))throw new ConflictException('Transfira os saldos incompatíveis para a reserva física antes de alterar o modo');
      const updated=await tx.inventorySettings.updateMany({where:{id:1,version:input.version},data:{mode:input.mode,version:{increment:1},updatedBy:actor}});
      if(!updated.count)throw new ConflictException('Configuração alterada; recarregue antes de tentar novamente');
      return {mode:input.mode,version:input.version+1};
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:15000});
  });}
}
