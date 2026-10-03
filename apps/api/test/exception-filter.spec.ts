import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { DomainError } from '../src/common/domain-error';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  HttpStatus,
  ArgumentsHost,
} from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ERRORS } from '@repo/shared';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ method: 'GET', url: '/test' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats DomainError with custom code, message, fieldErrors, details', () => {
    const error = new DomainError(
      ERRORS.INVALID_SETTING_VALUE,
      HttpStatus.BAD_REQUEST,
      'Invalid timezone',
      { timezone: 'Must be IANA string' },
      { provided: 'Moon/Base1' },
    );

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_SETTING_VALUE',
        message: 'Invalid timezone',
        fieldErrors: { timezone: 'Must be IANA string' },
        details: { provided: 'Moon/Base1' },
      },
    });
  });

  it('formats standard NestJS UnauthorizedException', () => {
    const error = new UnauthorizedException('Please log in');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Please log in',
      },
    });
  });

  it('formats standard NestJS ForbiddenException', () => {
    const error = new ForbiddenException('Forbidden resource');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden resource',
      },
    });
  });

  it('formats standard NestJS NotFoundException', () => {
    const error = new NotFoundException('Dish not found');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Dish not found',
      },
    });
  });

  it('formats Prisma P2002 unique constraint violation to 409 CONFLICT', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['email'] },
      },
    );

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'CONFLICT',
        message: 'Unique constraint violation on: email',
        details: { target: ['email'] },
      },
    });
  });

  it('formats Prisma P2025 record not found to 404 NOT_FOUND', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found',
      {
        code: 'P2025',
        clientVersion: '6.0.0',
      },
    );

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Record not found',
      },
    });
  });

  it('formats ZodError to 400 VALIDATION_ERROR with fieldErrors', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      age: z.number().min(0, 'Age must be positive'),
    });

    try {
      schema.parse({ name: '', age: -5 });
    } catch (zodErr) {
      filter.catch(zodErr, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: {
            name: 'Name is required',
            age: 'Age must be positive',
          },
        },
      });
    }
  });

  it('formats generic unhandled Error to 500 INTERNAL_ERROR', () => {
    const loggerSpy = vi
      .spyOn((filter as any).logger, 'error')
      .mockImplementation(() => {});

    const error = new Error('Unexpected database failure');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected database failure',
      },
    });

    expect(loggerSpy).toHaveBeenCalled();
    loggerSpy.mockRestore();
  });
});
