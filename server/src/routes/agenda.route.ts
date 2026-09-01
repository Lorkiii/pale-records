// Registers authenticated Agenda category, event, completion, and legacy import endpoints.
import { Router } from "express";

import {
  completeAgendaEventController,
  createAgendaEventController,
  deleteAgendaEventController,
  importAgendaEventController,
  listAgendaEventsController,
  reopenAgendaEventController,
  updateAgendaEventController,
} from "../controllers/agenda.controller.js";
import {
  createAgendaCategoryController,
  deleteAgendaCategoryController,
  listAgendaCategoriesController,
  restoreAgendaCategoryDefaultsController,
  updateAgendaCategoryController,
} from "../controllers/agenda-category.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import { validateQuery } from "../middleware/validate-query.js";
import {
  agendaEventIdParamsSchema,
  createAgendaEventSchema,
  importAgendaEventSchema,
  listAgendaEventsQuerySchema,
  updateAgendaEventSchema,
} from "../validations/agenda.schema.js";
import {
  agendaCategoryIdParamsSchema,
  createAgendaCategorySchema,
  updateAgendaCategorySchema,
} from "../validations/agenda-category.schema.js";

const agendaRouter = Router();

agendaRouter.use(requireAuthenticatedUser);
agendaRouter.get("/categories", listAgendaCategoriesController);
agendaRouter.post(
  "/categories",
  validateBody(createAgendaCategorySchema),
  createAgendaCategoryController,
);
agendaRouter.post(
  "/categories/restore-defaults",
  restoreAgendaCategoryDefaultsController,
);
agendaRouter.patch(
  "/categories/:categoryId",
  validateParams(agendaCategoryIdParamsSchema),
  validateBody(updateAgendaCategorySchema),
  updateAgendaCategoryController,
);
agendaRouter.post(
  "/events/:eventId/complete",
  validateParams(agendaEventIdParamsSchema),
  completeAgendaEventController,
);
agendaRouter.post(
  "/events/:eventId/reopen",
  validateParams(agendaEventIdParamsSchema),
  reopenAgendaEventController,
);
agendaRouter.delete(
  "/categories/:categoryId",
  validateParams(agendaCategoryIdParamsSchema),
  deleteAgendaCategoryController,
);
agendaRouter.get(
  "/events",
  validateQuery(listAgendaEventsQuerySchema),
  listAgendaEventsController,
);
agendaRouter.post(
  "/events",
  validateBody(createAgendaEventSchema),
  createAgendaEventController,
);
agendaRouter.post(
  "/events/import",
  validateBody(importAgendaEventSchema),
  importAgendaEventController,
);
agendaRouter.patch(
  "/events/:eventId",
  validateParams(agendaEventIdParamsSchema),
  validateBody(updateAgendaEventSchema),
  updateAgendaEventController,
);
agendaRouter.delete(
  "/events/:eventId",
  validateParams(agendaEventIdParamsSchema),
  deleteAgendaEventController,
);

export default agendaRouter;
