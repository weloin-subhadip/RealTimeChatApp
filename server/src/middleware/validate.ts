import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "./errorHandler.js";

/**
 * Validates and replaces req.body with the parsed result. On failure, throws a
 * 400 AppError listing the offending fields.
 */
export const validateBody =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      return next(new AppError(400, message));
    }
    req.body = result.data;
    next();
  };
