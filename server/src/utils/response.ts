import { Response } from 'express';
import { ApiResponse, PaginatedResponse, ApiErrorResponse } from '@necessity/shared';
import { HTTP_STATUS } from '../constants';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = HTTP_STATUS.OK
): Response {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  statusCode: number = HTTP_STATUS.OK
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPrevPage: pagination.page > 1,
    },
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: any,
  stack?: string
): Response {
  const response: ApiErrorResponse = {
    success: false,
    code,
    message,
    error: {
      code,
      message,
      details,
      stack,
    },
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}
