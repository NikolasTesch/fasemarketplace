import {MiddlewareConsumer,Module,NestModule} from '@nestjs/common';
import type {Request,Response,NextFunction} from 'express';
import {LocalAccessModule} from '../access/module.js';
import {BusinessPersistenceModule} from '../persistence/module.js';
import {CatalogController} from './controller.js';
import {CatalogService} from './service.js';

@Module({imports:[LocalAccessModule,BusinessPersistenceModule],controllers:[CatalogController],providers:[CatalogService]})
export class CatalogModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply((_req: Request,res: Response,next: NextFunction)=>{res.setHeader('cache-control','no-store');next();}).forRoutes(CatalogController);
  }
}
