import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { DomainError } from '../domain-error';
import { ERRORS } from '@repo/shared';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERRORS.INTERNAL_ERROR;
    let message = 'Internal server error';
    let fieldErrors: Record<string, string> | undefined = undefined;
    let details: any = undefined;

    if (exception instanceof DomainError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      fieldErrors = exception.fieldErrors;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ERRORS.VALIDATION_ERROR;
      message = 'Validation failed';
      fieldErrors = {};
      for (const issue of exception.issues) {
        const path = issue.path.join('.');
        fieldErrors[path || 'value'] = issue.message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = ERRORS.CONFLICT;
        const target = exception.meta?.target;
        message = `Unique constraint violation${target ? ` on: ${Array.isArray(target) ? target.join(', ') : target}` : ''}`;
        details = { target };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = ERRORS.NOT_FOUND;
        message = 'Record not found';
        details = exception.meta;
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        code = ERRORS.VALIDATION_ERROR;
        message = 'Foreign key constraint failed';
        details = exception.meta;
      } else {
        status = HttpStatus.BAD_REQUEST;
        code = ERRORS.VALIDATION_ERROR;
        message = `Database operation failed (${exception.code})`;
        details = exception.meta;
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message
          ? Array.isArray(resObj.message)
            ? resObj.message.join('; ')
            : resObj.message
          : exception.message;

        if (Array.isArray(resObj.message)) {
          fieldErrors = {};
          for (const msg of resObj.message) {
            fieldErrors['error'] = msg;
          }
        }
        if (resObj.details !== undefined) {
          details = resObj.details;
        }
      } else {
        message = exception.message;
      }

      switch (status) {
        case HttpStatus.UNAUTHORIZED:
          code = ERRORS.UNAUTHORIZED;
          break;
        case HttpStatus.FORBIDDEN:
          code = ERRORS.FORBIDDEN;
          break;
        case HttpStatus.NOT_FOUND:
          code = ERRORS.NOT_FOUND;
          break;
        case HttpStatus.CONFLICT:
          code = ERRORS.CONFLICT;
          break;
        case HttpStatus.BAD_REQUEST:
          code = ERRORS.VALIDATION_ERROR;
          break;
        default:
          code = ERRORS.INTERNAL_ERROR;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception on ${request?.method} ${request?.url}: ${exception.message}`,
        exception.stack,
      );
      message = exception.message;
    } else {
      this.logger.error(
        `Unknown exception on ${request?.method} ${request?.url}`,
        JSON.stringify(exception),
      );
    }

    const payload: {
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string>;
        details?: any;
      };
    } = {
      error: {
        code,
        message,
        ...(fieldErrors && Object.keys(fieldErrors).length > 0
          ? { fieldErrors }
          : {}),
        ...(details !== undefined ? { details } : {}),
      },
    };

    response.status(status).json(payload);
  }
}
