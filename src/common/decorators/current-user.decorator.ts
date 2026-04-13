import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUser } from '../interfaces/current-user.interface';

export const CurrentUserDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
