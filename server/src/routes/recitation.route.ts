// Defines authenticated manual Recitation session, monthly listing, loading, and roster routes.
import { Router } from "express";

import {
  createRecitationSessionController,
  listRecitationSessionsController,
  loadRecitationSessionController,
  saveRecitationRecordsController,
} from "../controllers/recitation.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import { validateQuery } from "../middleware/validate-query.js";
import {
  createRecitationSessionSchema,
  listRecitationSessionsQuerySchema,
  recitationClassIdParamsSchema,
  recitationSessionIdParamsSchema,
  saveRecitationRecordsSchema,
} from "../validations/recitation.schema.js";

const recitationRouter = Router();

recitationRouter.use(requireAuthenticatedUser);
recitationRouter.post(
  "/classes/:classId/sessions",
  validateParams(recitationClassIdParamsSchema),
  validateBody(createRecitationSessionSchema),
  createRecitationSessionController,
);
recitationRouter.get(
  "/classes/:classId/sessions",
  validateParams(recitationClassIdParamsSchema),
  validateQuery(listRecitationSessionsQuerySchema),
  listRecitationSessionsController,
);
recitationRouter.get(
  "/sessions/:sessionId",
  validateParams(recitationSessionIdParamsSchema),
  loadRecitationSessionController,
);
recitationRouter.put(
  "/sessions/:sessionId/records",
  validateParams(recitationSessionIdParamsSchema),
  validateBody(saveRecitationRecordsSchema),
  saveRecitationRecordsController,
);

export default recitationRouter;
