import {MiddlewareConsumer,Module,NestModule} from '@nestjs/common';
import type {Request,Response,NextFunction} from 'express';
import {LocalAccessModule} from '../access/module.js';
import {BusinessPersistenceModule} from '../persistence/module.js';
import {InventoryController} from './controller.js';
import {InventoryService} from './service.js';

@Module({imports:[LocalAccessModule,BusinessPersistenceModule],controllers:[InventoryController],providers:[InventoryService]})
export class InventoryModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply((_req: Request,res: Response,next: NextFunction)=>{res.setHeader('cache-control','no-store');next();}).forRoutes(InventoryController);
  }
}
