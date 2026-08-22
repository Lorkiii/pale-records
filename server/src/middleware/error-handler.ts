  // Converts parser and unexpected failures into stable, safe JSON responses.
  import type { ErrorRequestHandler } from "express";

  import {
    internalServerErrorResponseSchema,
    malformedJsonResponseSchema,
    payloadTooLargeResponseSchema,
  } from "../validations/error.response.js";

  type RequestBodyError = Error & {
    status?: number;
    type?: string;
  };

  function isRequestBodyParseError(
    error: unknown,
  ): error is RequestBodyError {
    const candidate = error as RequestBodyError;

    return (
      error instanceof SyntaxError &&
      candidate.status === 400 &&
      candidate.type === "entity.parse.failed"
    );
  }

  function isPayloadTooLargeError(error: unknown): error is RequestBodyError {
    const candidate = error as RequestBodyError;

    return candidate.status === 413 && candidate.type === "entity.too.large";
  }

  export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (isPayloadTooLargeError(error)) {
      const response = payloadTooLargeResponseSchema.parse({
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "The request body is too large.",
        },
      });

      res.status(413).json(response);
      return;
    }

    if (isRequestBodyParseError(error)) {
      const response = malformedJsonResponseSchema.parse({
        success: false,
        error: {
          code: "MALFORMED_JSON",
          message: "The request body must contain valid JSON.",
        },
      });

      res.status(400).json(response);
      return;
    }

    console.error("Unhandled request error", {
      method: req.method,
      path: req.path,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    const response = internalServerErrorResponseSchema.parse({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected server error occurred.",
      },
    });

    res.status(500).json(response);
  };
