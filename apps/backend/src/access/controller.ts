import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LocalAccessService } from './service.js';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(LocalAccessService) private readonly access: LocalAccessService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    await this.access.principal(request, true);
    return true;
  }
}
@Controller('access')
export class LocalAccessController {
  constructor(
    @Inject(LocalAccessService) private readonly access: LocalAccessService,
  ) {}
  @Post('login') @HttpCode(200) login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
  ) {
    return this.access.login(req, res, body);
  }
  @Get('session') @UseGuards(AccessGuard) session(@Req() req: Request) {
    return this.access.session(req);
  }
  @Post('logout') @HttpCode(200) @UseGuards(AccessGuard) logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.access.logout(req, res);
  }
  @Post('password') @HttpCode(200) @UseGuards(AccessGuard) password(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
  ) {
    return this.access.changePassword(req, res, body);
  }
  @Get('users') @UseGuards(AccessGuard) list(
    @Req() req: Request,
    @Query('offset') offset = '0',
  ) {
    return this.access.list(req, Number(offset));
  }
  @Post('users') @UseGuards(AccessGuard) create(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return this.access.create(req, body);
  }
  @Post('users/:id/block') @HttpCode(200) @UseGuards(AccessGuard) block(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.access.block(req, id, body);
  }
  @Post('users/:id/password') @HttpCode(200) @UseGuards(AccessGuard) reset(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.access.resetPassword(req, id, body);
  }
}
