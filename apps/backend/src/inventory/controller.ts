import {Body,Controller,Get,HttpCode,Inject,Param,Post,Query,Req} from '@nestjs/common';
import type {Request} from 'express';
import {InventoryService} from './service.js';

@Controller('inventory')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}
  @Get('stock') stock(@Req() req: Request,@Query() query: unknown) {return this.inventory.stock(req,query);}
  @Get('movements') movements(@Req() req: Request,@Query() query: unknown) {return this.inventory.movements(req,query);}
  @Get('settings') settings(@Req() req: Request) {return this.inventory.settings(req);}
  @Post('movements') movement(@Req() req: Request,@Body() body: unknown) {return this.inventory.createMovement(req,body);}
  @Post('variants/:id/minimum') @HttpCode(200) minimum(@Req() req: Request,@Param('id') id: string,@Body() body: unknown) {return this.inventory.setMinimum(req,id,body);}
  @Post('settings/mode') @HttpCode(200) mode(@Req() req: Request,@Body() body: unknown) {return this.inventory.setMode(req,body);}
}
