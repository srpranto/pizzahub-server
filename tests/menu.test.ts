import assert from "node:assert/strict";
import { isValidObjectId, toObjectId, isValidIsoDate } from "../src/utils/validate.js";
import { CATEGORIES, MENU_STATUSES, ORDER_STATUSES, USER_ROLES } from "../src/config/constants.js";

export async function runMenuTests(): Promise<void> {
  assert.equal(isValidObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isValidObjectId("invalid-id"), false);
  assert.equal(isValidObjectId(""), false);

  const parsed = toObjectId("507f1f77bcf86cd799439011");
  assert.equal(parsed.toString(), "507f1f77bcf86cd799439011");

  assert.equal(isValidIsoDate("2026-12-01"), true);
  assert.equal(isValidIsoDate("invalid-date"), false);

  assert.equal(CATEGORIES.length, 6);
  assert.equal(CATEGORIES.includes("Classic Pizzas"), true);
  assert.equal(CATEGORIES.includes("Vegetarian Pizzas"), true);
  assert.equal(CATEGORIES.includes("Meat Lovers"), true);
  assert.equal(CATEGORIES.includes("Specialty / Gourmet Pizzas"), true);
  assert.equal(CATEGORIES.includes("Sides & Appetizers"), true);
  assert.equal(CATEGORIES.includes("Beverages & Desserts"), true);

  assert.equal(MENU_STATUSES.length, 4);
  assert.equal(ORDER_STATUSES.length, 4);
  assert.equal(USER_ROLES.length, 3);
}
