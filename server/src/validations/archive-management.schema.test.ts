// Verifies bounded archived paging, unique deletion selections, and safe response shapes.
import assert from "node:assert/strict";
import test from "node:test";
import {
  archivedBatchDeleteResponseSchema,
  archivedPageQuerySchema,
  deleteArchivedBatchSchema,
} from "./archive-management.schema.js";

const firstId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const secondId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";

test("archived paging defaults to the first bounded page", () => {
  assert.deepEqual(archivedPageQuerySchema.parse({}), { page: 1 });
  assert.deepEqual(archivedPageQuerySchema.parse({ page: "2" }), { page: 2 });
  for (const query of [{ page: "0" }, { page: "10001" }, { page: "2.5" }, { page: "2", status: "active" }]) {
    assert.equal(archivedPageQuerySchema.safeParse(query).success, false);
  }
});

test("archive deletion accepts one or several unique IDs and a current password", () => {
  assert.deepEqual(deleteArchivedBatchSchema.parse({
    ids: [firstId, secondId],
    currentPassword: "current-password",
  }), { ids: [firstId, secondId], currentPassword: "current-password" });

  for (const body of [
    { ids: [], currentPassword: "password" },
    { ids: [firstId, firstId], currentPassword: "password" },
    { ids: ["not-an-id"], currentPassword: "password" },
    { ids: [firstId], currentPassword: "" },
    { ids: [firstId], currentPassword: "password", userId: secondId },
    { ids: Array.from({ length: 51 }, () => firstId), currentPassword: "password" },
  ]) {
    assert.equal(deleteArchivedBatchSchema.safeParse(body).success, false);
  }
});

test("deletion response excludes passwords and unapproved fields", () => {
  assert.equal(archivedBatchDeleteResponseSchema.safeParse({
    success: true,
    data: { deletedIds: [firstId] },
  }).success, true);
  assert.equal(archivedBatchDeleteResponseSchema.safeParse({
    success: true,
    data: { deletedIds: [firstId], currentPassword: "password" },
  }).success, false);
});
