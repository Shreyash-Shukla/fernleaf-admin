import { HttpException, HttpStatus } from '@nestjs/common';
import { ERRORS, ErrorCode } from '@repo/shared';

export class DomainError extends HttpException {
  public readonly code: string;
  public readonly fieldErrors?: Record<string, string>;
  public readonly details?: any;

  constructor(
    code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    message?: string,
    fieldErrors?: Record<string, string>,
    details?: any,
  ) {
    super(message || code, status);
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }

  static badRequest(code: string, message?: string, fieldErrors?: Record<string, string>, details?: any): DomainError {
    return new DomainError(code, HttpStatus.BAD_REQUEST, message, fieldErrors, details);
  }

  static unauthorized(code: string = ERRORS.UNAUTHORIZED, message?: string): DomainError {
    return new DomainError(code, HttpStatus.UNAUTHORIZED, message || 'Unauthorized');
  }

  static forbidden(code: string = ERRORS.FORBIDDEN, message?: string): DomainError {
    return new DomainError(code, HttpStatus.FORBIDDEN, message || 'Forbidden');
  }

  static notFound(code: string = ERRORS.NOT_FOUND, message?: string): DomainError {
    return new DomainError(code, HttpStatus.NOT_FOUND, message || 'Not found');
  }

  static conflict(code: string = ERRORS.CONFLICT, message?: string, details?: any): DomainError {
    return new DomainError(code, HttpStatus.CONFLICT, message || 'Conflict', undefined, details);
  }

  static unprocessable(code: string, message?: string, fieldErrors?: Record<string, string>, details?: any): DomainError {
    return new DomainError(code, HttpStatus.UNPROCESSABLE_ENTITY, message, fieldErrors, details);
  }
}
