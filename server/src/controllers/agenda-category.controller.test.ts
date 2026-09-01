// Verifies Agenda category controllers, trusted ownership, expected outcomes, and validation.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";

import {
  createAgendaCategoryControllerHandlers,
  type AgendaCategoryControllerDependencies,
} from "./agenda-category.controller.js";
import { errorHandler } from "../middleware/error-handler.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import {
  agendaCategoryIdParamsSchema,
  createAgendaCategorySchema,
  updateAgendaCategorySchema,
} from "../validations/agenda-category.schema.js";
import type { AgendaCategoryRecord } from "../validations/agenda-category.response.js";

const userId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";
const categoryId = "805a2580-d0b5-48a8-8eb3-9356e464b838";
const category: AgendaCategoryRecord = {
  id: categoryId,
  name: "Student Consultation",
  shortCode: "CNSLT",
  accentKey: "SIGNAL_OCHRE",
  description: null,
  isDefault: false,
  isActive: true,
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    name: category.name,
    shortCode: category.shortCode,
    accentKey: category.accentKey,
    description: category.description,
    ...overrides,
  };
}

function createTestApp(overrides: Partial<AgendaCategoryControllerDependencies> = {}) {
  const dependencies: AgendaCategoryControllerDependencies = {
    listCategories: async () => [category],
    createCategory: async () => ({ status: "created", category }),
    updateCategory: async () => ({ status: "updated", category }),
    deleteCategory: async () => ({ status: "deleted" }),
    restoreDefaults: async () => [category],
    ...overrides,
  };
  const handlers = createAgendaCategoryControllerHandlers(dependencies);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.authenticatedUser = {
      id: userId,
      firstName: "Ana",
      lastName: "Reyes",
      username: "ana.reyes",
      email: "ana@example.com",
    };
    next();
  });
  app.get("/categories", handlers.listAgendaCategoriesController);
  app.post("/categories", validateBody(createAgendaCategorySchema), handlers.createAgendaCategoryController);
  app.post("/categories/restore-defaults", handlers.restoreAgendaCategoryDefaultsController);
  app.patch(
    "/categories/:categoryId",
    validateParams(agendaCategoryIdParamsSchema),
    validateBody(updateAgendaCategorySchema),
    handlers.updateAgendaCategoryController,
  );
  app.delete(
    "/categories/:categoryId",
    validateParams(agendaCategoryIdParamsSchema),
    handlers.deleteAgendaCategoryController,
  );
  app.use(errorHandler);
  return app;
}

test("Agenda category controllers pass only the authenticated owner and return safe records", async () => {
  const receivedUserIds: string[] = [];
  const app = createTestApp({
    listCategories: async (trustedUserId) => {
      receivedUserIds.push(trustedUserId);
      return [category];
    },
    createCategory: async (trustedUserId) => {
      receivedUserIds.push(trustedUserId);
      return { status: "created", category };
    },
    updateCategory: async (trustedUserId) => {
      receivedUserIds.push(trustedUserId);
      return { status: "updated", category };
    },
    deleteCategory: async (trustedUserId) => {
      receivedUserIds.push(trustedUserId);
      return { status: "deactivated" };
    },
    restoreDefaults: async (trustedUserId) => {
      receivedUserIds.push(trustedUserId);
      return [category];
    },
  });

  const responses = await Promise.all([
    request(app).get("/categories"),
    request(app).post("/categories").send(body()),
    request(app).patch(`/categories/${categoryId}`).send({ ...body(), isActive: true }),
    request(app).delete(`/categories/${categoryId}`),
    request(app).post("/categories/restore-defaults"),
  ]);
  assert.deepEqual(receivedUserIds, [userId, userId, userId, userId, userId]);
  assert.deepEqual(responses.map((response) => response.status), [200, 201, 200, 200, 200]);
  assert.equal(responses[0].body.data.categories[0].userId, undefined);
  assert.equal(responses[3].body.data.result, "DEACTIVATED");
});

test("Agenda category controllers expose safe not-found, duplicate, and limit outcomes", async () => {
  const missing = await request(createTestApp({
    updateCategory: async () => ({ status: "category_not_found" }),
  })).patch(`/categories/${categoryId}`).send({ ...body(), isActive: true });
  const conflict = await request(createTestApp({
    createCategory: async () => ({ status: "short_code_conflict" }),
  })).post("/categories").send(body());
  const limit = await request(createTestApp({
    createCategory: async () => ({ status: "limit_reached" }),
  })).post("/categories").send(body());

  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "AGENDA_CATEGORY_NOT_FOUND");
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.body.error.details.fieldErrors.shortCode, ["Choose a different short code."]);
  assert.equal(limit.status, 409);
  assert.equal(limit.body.error.code, "AGENDA_CATEGORY_LIMIT_REACHED");
});

test("Agenda category validation rejects unsafe fields before service access", async () => {
  let serviceWasCalled = false;
  const app = createTestApp({
    createCategory: async () => {
      serviceWasCalled = true;
      return { status: "created", category };
    },
  });
  const response = await request(app).post("/categories").send({
    ...body(),
    userId: "client-controlled",
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  assert.equal(serviceWasCalled, false);
});

test("Unexpected Agenda category failures use the centralized safe error", async (t) => {
  t.mock.method(console, "error", () => undefined);
  const response = await request(createTestApp({
    restoreDefaults: async () => {
      throw new Error("private database detail");
    },
  })).post("/categories/restore-defaults");

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
});
