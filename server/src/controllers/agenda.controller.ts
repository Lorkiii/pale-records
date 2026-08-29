// Converts authenticated Agenda requests into safe expected errors and public response envelopes.
import type { NextFunction, Request, Response } from "express";

import type { AuthenticatedResponseLocals } from "../middleware/require-authenticated-user.js";
import {
  createAgendaEvent,
  deleteAgendaEvent,
  importAgendaEvent,
  listAgendaEvents,
  updateAgendaEvent,
} from "../services/agenda.service.js";
import type {
  AgendaEventIdParams,
  CreateAgendaEventInput,
  ImportAgendaEventInput,
  ListAgendaEventsQuery,
  UpdateAgendaEventInput,
} from "../validations/agenda.schema.js";
import {
  agendaClassNotFoundResponseSchema,
  agendaEventCreateResponseSchema,
  agendaEventDeleteResponseSchema,
  agendaEventImportResponseSchema,
  agendaEventListResponseSchema,
  agendaEventNotFoundResponseSchema,
  agendaEventUpdateResponseSchema,
} from "../validations/agenda.response.js";

export type AgendaControllerDependencies = {
  listEvents: typeof listAgendaEvents;
  createEvent: typeof createAgendaEvent;
  importEvent: typeof importAgendaEvent;
  updateEvent: typeof updateAgendaEvent;
  deleteEvent: typeof deleteAgendaEvent;
};

type AgendaResponseLocals = AuthenticatedResponseLocals & {
  validatedQuery?: unknown;
};

const defaultDependencies: AgendaControllerDependencies = {
  listEvents: listAgendaEvents,
  createEvent: createAgendaEvent,
  importEvent: importAgendaEvent,
  updateEvent: updateAgendaEvent,
  deleteEvent: deleteAgendaEvent,
};

// Returns the same safe event absence for missing and differently owned identifiers.
function sendAgendaEventNotFoundResponse(
  res: Response<unknown, AgendaResponseLocals>,
) {
  return res.status(404).json(agendaEventNotFoundResponseSchema.parse({
    success: false,
    error: {
      code: "AGENDA_EVENT_NOT_FOUND",
      message: "Agenda event was not found.",
    },
  }));
}

// Returns the expected safe error for an invalid Class association.
function sendAgendaClassNotFoundResponse(
  res: Response<unknown, AgendaResponseLocals>,
) {
  return res.status(404).json(agendaClassNotFoundResponseSchema.parse({
    success: false,
    error: {
      code: "AGENDA_CLASS_NOT_FOUND",
      message: "Associated class was not found.",
    },
  }));
}

// Builds Agenda handlers around replaceable service functions for isolated HTTP tests.
export function createAgendaControllerHandlers(
  dependencies: AgendaControllerDependencies = defaultDependencies,
) {
  const listAgendaEventsController = async (
    req: Request,
    res: Response<unknown, AgendaResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const query = res.locals.validatedQuery as ListAgendaEventsQuery;
      const events = await dependencies.listEvents(
        res.locals.authenticatedUser.id,
        query.from,
        query.to,
      );

      return res.status(200).json(agendaEventListResponseSchema.parse({
        success: true,
        data: { events },
      }));
    } catch (error) {
      next(error);
    }
  };

  const createAgendaEventController = async (
    req: Request<Record<string, never>, unknown, CreateAgendaEventInput>,
    res: Response<unknown, AgendaResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.createEvent(
        res.locals.authenticatedUser.id,
        req.body,
      );

      if (result.status === "class_not_found") {
        return sendAgendaClassNotFoundResponse(res);
      }

      return res.status(201).json(agendaEventCreateResponseSchema.parse({
        success: true,
        data: { event: result.event },
      }));
    } catch (error) {
      next(error);
    }
  };

  const importAgendaEventController = async (
    req: Request<Record<string, never>, unknown, ImportAgendaEventInput>,
    res: Response<unknown, AgendaResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.importEvent(
        res.locals.authenticatedUser.id,
        req.body,
      );

      return res.status(200).json(agendaEventImportResponseSchema.parse({
        success: true,
        data: result,
      }));
    } catch (error) {
      next(error);
    }
  };

  const updateAgendaEventController = async (
    req: Request<AgendaEventIdParams, unknown, UpdateAgendaEventInput>,
    res: Response<unknown, AgendaResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.updateEvent(
        res.locals.authenticatedUser.id,
        req.params.eventId,
        req.body,
      );

      if (result.status === "event_not_found") {
        return sendAgendaEventNotFoundResponse(res);
      }

      if (result.status === "class_not_found") {
        return sendAgendaClassNotFoundResponse(res);
      }

      return res.status(200).json(agendaEventUpdateResponseSchema.parse({
        success: true,
        data: { event: result.event },
      }));
    } catch (error) {
      next(error);
    }
  };

  const deleteAgendaEventController = async (
    req: Request<AgendaEventIdParams>,
    res: Response<unknown, AgendaResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.deleteEvent(
        res.locals.authenticatedUser.id,
        req.params.eventId,
      );

      if (result.status === "event_not_found") {
        return sendAgendaEventNotFoundResponse(res);
      }

      return res.status(200).json(agendaEventDeleteResponseSchema.parse({
        success: true,
        data: { eventId: req.params.eventId },
      }));
    } catch (error) {
      next(error);
    }
  };

  return {
    listAgendaEventsController,
    createAgendaEventController,
    importAgendaEventController,
    updateAgendaEventController,
    deleteAgendaEventController,
  };
}

export const {
  listAgendaEventsController,
  createAgendaEventController,
  importAgendaEventController,
  updateAgendaEventController,
  deleteAgendaEventController,
} = createAgendaControllerHandlers();
