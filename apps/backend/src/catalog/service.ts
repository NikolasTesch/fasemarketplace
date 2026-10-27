import {BadRequestException, ConflictException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException} from '@nestjs/common';
import type {Request} from 'express';
import {Prisma} from '../generated/prisma/client.js';
import {LocalAccessService} from '../access/service.js';
import {BusinessPersistence} from '../persistence/module.js';
import {catalogId, catalogQuery, productInput, productEdit, variantInput, variantEdit} from './validation.js';

const include = {variants:{orderBy:[{createdAt:'asc' as const},{id:'asc' as const}],take:50},_count:{select:{variants:true}}} satisfies Prisma.CatalogProductInclude;
type Product = Prisma.CatalogProductGetPayload<{include:typeof include}>;
type Variant = Prisma.CatalogVariantGetPayload<Record<string,never>>;
function variantDto(v: Variant, parentActive: boolean) {
  return {id:v.id,productId:v.productId,name:v.name,sku:v.sku,active:v.active,effectiveActive:v.active&&parentActive,version:v.version};
}
function productDto(p: Product) {
  return {id:p.id,name:p.name,description:p.description,active:p.active,version:p.version,createdAt:p.createdAt.toISOString(),
    variantCount:p._count.variants,variants:p.variants.map(v=>variantDto(v,p.active))};
}
function failed(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code==='P2002') throw new ConflictException('SKU já cadastrado ou repetido');
    if (error.code==='P2034') throw new ConflictException('O cadastro mudou. Recarregue antes de tentar novamente');
  }
  throw new ServiceUnavailableException('Catálogo temporariamente indisponível');
}
function changed(): never {throw new ConflictException('O cadastro mudou. Recarregue antes de tentar novamente');}
function missing(): never {throw new NotFoundException('Cadastro não encontrado');}

@Injectable()
export class CatalogService {
  constructor(@Inject(BusinessPersistence) private readonly persistence: BusinessPersistence,
    @Inject(LocalAccessService) private readonly access: LocalAccessService) {}
  private get db() {if(!this.persistence.client) throw new ServiceUnavailableException('Catálogo indisponível');return this.persistence.client;}
  private async write<T>(req: Request, operation: (actor: string)=>Promise<T>) {
    try {
      this.access.assertOrigin(req);
      // Serialize with auth block/reset, then revalidate the actor inside the lock.
      return await this.access.exclusive(async()=>{const {user}=await this.access.principal(req,false,true);return operation(user.id);});
    } catch(e) {return failed(e);}
  }
  async list(req: Request, input: unknown) {
    try {
      await this.access.principal(req);
      const query=catalogQuery(input), literal=query.search.replace(/[\\%_]/g,'\\$&');
      const where: Prisma.CatalogProductWhereInput={
        ...(query.status==='all'?{}:{active:query.status==='active'}),
        ...(literal?{OR:[{name:{contains:literal,mode:'insensitive'}},
          {variants:{some:{OR:[{name:{contains:literal,mode:'insensitive'}},{sku:{contains:literal,mode:'insensitive'}}]}}}]}:{}),
      };
      const [total,rows]=await this.db.$transaction([this.db.catalogProduct.count({where}),
        this.db.catalogProduct.findMany({where,skip:query.offset,take:20,orderBy:[{createdAt:'desc'},{id:'asc'}],include})],{isolationLevel:'RepeatableRead'});
      return {items:rows.map(productDto),total,offset:query.offset,limit:20};
    } catch(e) {return failed(e);}
  }
  create(req: Request, body: unknown) {
    return this.write(req,async actor=>{
      const data=productInput(body);
      const p=await this.db.catalogProduct.create({data:{name:data.name,description:data.description,createdBy:actor,updatedBy:actor,
        variants:{create:data.variants.map(v=>({name:v.name,sku:v.sku,createdBy:actor,updatedBy:actor}))}},include});
      return productDto(p);
    });
  }
  editProduct(req: Request, value: string, body: unknown) {
    return this.write(req,async actor=>{
      const id=catalogId(value),{version,...data}=productEdit(body);
      return this.db.$transaction(async tx=>{
        const result=await tx.catalogProduct.updateMany({where:{id,version},data:{...data,version:{increment:1},updatedBy:actor}});
        const p=await tx.catalogProduct.findUnique({where:{id},include});
        if(!p)return missing();if(!result.count)return changed();return productDto(p);
      });
    });
  }
  addVariant(req: Request, value: string, body: unknown) {
    return this.write(req,async actor=>{
      const id=catalogId(value),data=variantInput(body,true);
      return this.db.$transaction(async tx=>{
        const updated=await tx.catalogProduct.updateMany({where:{id,version:data.version},data:{version:{increment:1},updatedBy:actor}});
        const parent=await tx.catalogProduct.findUnique({where:{id},select:{active:true}});
        if(!parent)return missing();if(!updated.count)return changed();
        if(await tx.catalogVariant.count({where:{productId:id}})>=50) throw new BadRequestException('Limite de 50 variantes por produto');
        const v=await tx.catalogVariant.create({data:{productId:id,name:data.name,sku:data.sku,createdBy:actor,updatedBy:actor}});
        return variantDto(v,parent.active);
      });
    });
  }
  editVariant(req: Request, value: string, body: unknown) {
    return this.write(req,async actor=>{
      const id=catalogId(value),{version,...data}=variantEdit(body);
      return this.db.$transaction(async tx=>{
        const result=await tx.catalogVariant.updateMany({where:{id,version},data:{...data,version:{increment:1},updatedBy:actor}});
        const v=await tx.catalogVariant.findUnique({where:{id},include:{product:{select:{active:true}}}});
        if(!v)return missing();if(!result.count)return changed();return variantDto(v,v.product.active);
      });
    });
  }
}
