import assert from "node:assert/strict";
import { CATEGORIES } from "../src/config/constants.js";

export function testVendorCapLogic(): void {
  const freePlanMax = 3;

  const countActiveItems = (items: Array<{ status: string }>) =>
    items.filter((i) => i.status === "pending" || i.status === "approved").length;

  const canCreateMenuItem = (
    subscriptionPlan: "free" | "premium",
    activeCount: number
  ): boolean => {
    if (subscriptionPlan !== "premium" && activeCount >= freePlanMax) {
      return false;
    }
    return true;
  };

  const canReactivateItem = (
    subscriptionPlan: "free" | "premium",
    activeCountExcludingCurrent: number
  ): boolean => {
    if (subscriptionPlan !== "premium" && activeCountExcludingCurrent >= freePlanMax) {
      return false;
    }
    return true;
  };

  const canVendorSelfApprove = (currentStatus: string): boolean => {
    if (currentStatus !== "approved" && currentStatus !== "inactive") {
      return false;
    }
    return true;
  };

  const isAllowedCategory = (category: string): boolean => {
    return CATEGORIES.includes(category as typeof CATEGORIES[number]);
  };

  const vendorFree2Items = [
    { status: "approved" },
    { status: "pending" },
    { status: "inactive" },
    { status: "rejected" },
  ];
  const active2 = countActiveItems(vendorFree2Items);
  assert.equal(active2, 2);
  assert.equal(canCreateMenuItem("free", active2), true);

  const vendorFree3Items = [
    { status: "approved" },
    { status: "pending" },
    { status: "approved" },
  ];
  const active3 = countActiveItems(vendorFree3Items);
  assert.equal(active3, 3);
  assert.equal(canCreateMenuItem("free", active3), false);

  assert.equal(canCreateMenuItem("premium", 3), true);
  assert.equal(canCreateMenuItem("premium", 10), true);

  assert.equal(canReactivateItem("free", 2), true);
  assert.equal(canReactivateItem("free", 3), false);
  assert.equal(canReactivateItem("premium", 3), true);

  assert.equal(canVendorSelfApprove("pending"), false);
  assert.equal(canVendorSelfApprove("rejected"), false);
  assert.equal(canVendorSelfApprove("approved"), true);
  assert.equal(canVendorSelfApprove("inactive"), true);

  assert.equal(isAllowedCategory("Classic Pizzas"), true);
  assert.equal(isAllowedCategory("Vegetarian Pizzas"), true);
  assert.equal(isAllowedCategory("Meat Lovers"), true);
  assert.equal(isAllowedCategory("Specialty / Gourmet Pizzas"), true);
  assert.equal(isAllowedCategory("Sides & Appetizers"), true);
  assert.equal(isAllowedCategory("Beverages & Desserts"), true);
  assert.equal(isAllowedCategory("Invalid Category"), false);
  assert.equal(isAllowedCategory(""), false);
}
