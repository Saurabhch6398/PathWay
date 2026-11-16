import type { Request, RequestHandler } from 'express';
import { idParamsSchema } from '@pathway/shared';
import type { ZodTypeAny } from 'zod';

/** Usage: router.post('/x', validate({ body: schema }), handler) */
export const validate =
  (schemas: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) schemas.query.parse(req.query);
      if (schemas.params) schemas.params.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };

/** The `:id` route param, validated as an ObjectId (typed as string, unlike req.params.id). */
export const getId = (req: Request): string => idParamsSchema.parse(req.params).id;
