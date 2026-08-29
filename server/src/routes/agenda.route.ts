// Defines authenticated Agenda CRUD and idempotent one-event legacy import endpoints.
import { Router } from "express";

import {
  createAgendaEventController,
  deleteAgendaEventController,
  importAgendaEventController,
  listAgendaEventsController,
  updateAgendaEventController,
} from "../controllers/agenda.controller.js";
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

const agendaRouter = Router();

agendaRouter.use(requireAuthenticatedUser);
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
