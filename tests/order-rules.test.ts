import assert from "node:assert/strict";

export function testOrderBusinessRules(): void {
  const isDuplicateActiveOrder = (
    existingOrders: Array<{
      customerId: string;
      itemId: string;
      deliveryDate: string;
      status: string;
    }>,
    target: { customerId: string; itemId: string; deliveryDate: string }
  ): boolean => {
    return existingOrders.some(
      (o) =>
        o.customerId === target.customerId &&
        o.itemId === target.itemId &&
        o.deliveryDate === target.deliveryDate &&
        (o.status === "pending" || o.status === "accepted")
    );
  };

  const canPlaceOrder = (
    userRole: string,
    itemVendorId: string,
    currentUserId: string,
    itemStatus: string
  ): { allowed: boolean; reason?: string } => {
    if (userRole !== "customer" && userRole !== "vendor") {
      return { allowed: false, reason: "Forbidden: Only customer and vendor accounts can place orders" };
    }
    if (itemStatus !== "approved") {
      return { allowed: false, reason: "Pizza item not approved" };
    }
    if (itemVendorId === currentUserId) {
      return { allowed: false, reason: "Vendors cannot place orders for their own items" };
    }
    return { allowed: true };
  };

  const canCancelOrder = (
    orderCustomerId: string,
    currentUserId: string,
    orderStatus: string
  ): boolean => {
    if (orderCustomerId !== currentUserId) return false;
    return orderStatus === "pending";
  };

  const canVendorTransitionStatus = (
    orderVendorId: string,
    currentUserId: string,
    orderStatus: string,
    nextStatus: string
  ): boolean => {
    if (orderVendorId !== currentUserId) return false;
    if (orderStatus !== "pending") return false;
    return nextStatus === "accepted" || nextStatus === "rejected";
  };

  assert.equal(
    canPlaceOrder("customer", "vendor1", "customer1", "approved").allowed,
    true
  );
  assert.equal(
    canPlaceOrder("admin", "vendor1", "admin1", "approved").allowed,
    false
  );
  assert.equal(
    canPlaceOrder("vendor", "vendor1", "vendor2", "approved").allowed,
    true
  );
  assert.equal(
    canPlaceOrder("vendor", "vendor1", "vendor1", "approved").allowed,
    false
  );
  assert.equal(
    canPlaceOrder("customer", "vendor1", "customer1", "pending").allowed,
    false
  );
  assert.equal(
    canPlaceOrder("customer", "vendor1", "vendor1", "approved").allowed,
    false
  );

  const existing = [
    {
      customerId: "cust1",
      itemId: "item1",
      deliveryDate: "2026-12-01",
      status: "pending",
    },
    {
      customerId: "cust1",
      itemId: "item2",
      deliveryDate: "2026-12-01",
      status: "accepted",
    },
    {
      customerId: "cust2",
      itemId: "item1",
      deliveryDate: "2026-12-01",
      status: "cancelled",
    },
    {
      customerId: "cust3",
      itemId: "item1",
      deliveryDate: "2026-12-01",
      status: "rejected",
    },
  ];

  assert.equal(
    isDuplicateActiveOrder(existing, {
      customerId: "cust1",
      itemId: "item1",
      deliveryDate: "2026-12-01",
    }),
    true
  );
  assert.equal(
    isDuplicateActiveOrder(existing, {
      customerId: "cust1",
      itemId: "item2",
      deliveryDate: "2026-12-01",
    }),
    true
  );
  assert.equal(
    isDuplicateActiveOrder(existing, {
      customerId: "cust2",
      itemId: "item1",
      deliveryDate: "2026-12-01",
    }),
    false
  );
  assert.equal(
    isDuplicateActiveOrder(existing, {
      customerId: "cust3",
      itemId: "item1",
      deliveryDate: "2026-12-01",
    }),
    false
  );
  assert.equal(
    isDuplicateActiveOrder(existing, {
      customerId: "cust1",
      itemId: "item1",
      deliveryDate: "2026-12-02",
    }),
    false
  );

  assert.equal(canCancelOrder("cust1", "cust1", "pending"), true);
  assert.equal(canCancelOrder("cust1", "cust1", "accepted"), false);
  assert.equal(canCancelOrder("cust1", "cust1", "rejected"), false);
  assert.equal(canCancelOrder("cust1", "cust1", "cancelled"), false);
  assert.equal(canCancelOrder("cust1", "cust2", "pending"), false);

  assert.equal(canVendorTransitionStatus("vend1", "vend1", "pending", "accepted"), true);
  assert.equal(canVendorTransitionStatus("vend1", "vend1", "pending", "rejected"), true);
  assert.equal(canVendorTransitionStatus("vend1", "vend1", "accepted", "rejected"), false);
  assert.equal(canVendorTransitionStatus("vend1", "vend1", "rejected", "accepted"), false);
  assert.equal(canVendorTransitionStatus("vend1", "vend2", "pending", "accepted"), false);
}
