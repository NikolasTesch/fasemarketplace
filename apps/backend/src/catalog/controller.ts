import {Body,Controller,Get,HttpCode,Inject,Param,Post,Query,Req} from '@nestjs/common';
import type {Request} from 'express';
import {CatalogService} from './service.js';

@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}
  @Get('products') list(@Req() req: Request,@Query() query: unknown) {return this.catalog.list(req,query);}
  @Post('products') create(@Req() req: Request,@Body() body: unknown) {return this.catalog.create(req,body);}
  @Post('products/:id') @HttpCode(200) edit(@Req() req: Request,@Param('id') id: string,@Body() body: unknown) {return this.catalog.editProduct(req,id,body);}
  @Post('products/:id/variants') variant(@Req() req: Request,@Param('id') id: string,@Body() body: unknown) {return this.catalog.addVariant(req,id,body);}
  @Post('variants/:id') @HttpCode(200) editVariant(@Req() req: Request,@Param('id') id: string,@Body() body: unknown) {return this.catalog.editVariant(req,id,body);}
}
