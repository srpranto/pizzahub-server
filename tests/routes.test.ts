import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { app } from "../src/index.js";

export async function testApiRoutes(): Promise<void> {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthData = (await healthRes.json()) as { success: boolean; data: { status: string } };
    assert.equal(healthData.success, true);
    assert.equal(healthData.data.status, "healthy");

    const featuredRes = await fetch(`${baseUrl}/api/menu/featured`);
    assert.equal(featuredRes.status, 200);
    const featuredData = (await featuredRes.json()) as { success: boolean; data: unknown[] };
    assert.equal(featuredData.success, true);
    assert.equal(Array.isArray(featuredData.data), true);

    const menuRes = await fetch(`${baseUrl}/api/menu?category=Classic+Pizzas&sort=price_asc&page=1&limit=6`);
    assert.equal(menuRes.status, 200);
    const menuData = (await menuRes.json()) as { success: boolean; data: unknown[]; total: number; page: number; limit: number };
    assert.equal(menuData.success, true);
    assert.equal(Array.isArray(menuData.data), true);
    assert.equal(menuData.page, 1);
    assert.equal(menuData.limit, 6);

    const adminTxRes = await fetch(`${baseUrl}/api/admin/transactions`);
    assert.equal(adminTxRes.status, 401);

    const adminUsersRes = await fetch(`${baseUrl}/api/admin/users`);
    assert.equal(adminUsersRes.status, 401);

    const vendorMenuRes = await fetch(`${baseUrl}/api/vendor/menu`);
    assert.equal(vendorMenuRes.status, 401);

    const ordersRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(ordersRes.status, 401);

    const statsCustRes = await fetch(`${baseUrl}/api/stats/customer`);
    assert.equal(statsCustRes.status, 401);

    const statsVendRes = await fetch(`${baseUrl}/api/stats/vendor`);
    assert.equal(statsVendRes.status, 401);

    const statsAdminRes = await fetch(`${baseUrl}/api/stats/admin`);
    assert.equal(statsAdminRes.status, 401);

    const stripeCheckoutRes = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(stripeCheckoutRes.status, 401);

    const stripeWebhookRes = await fetch(`${baseUrl}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(stripeWebhookRes.status, 400);

    const reviewsGetRes = await fetch(`${baseUrl}/api/menu/6b001111795c562732270001/reviews`);
    assert.equal(reviewsGetRes.status, 200);
    const reviewsGetData = (await reviewsGetRes.json()) as { success: boolean; data: { reviews: unknown[]; averageRating: number } };
    assert.equal(reviewsGetData.success, true);
    assert.equal(Array.isArray(reviewsGetData.data.reviews), true);

    const reviewPostRes = await fetch(`${baseUrl}/api/menu/6b001111795c562732270001/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, comment: "Crispy perfection!" }),
    });
    assert.equal(reviewPostRes.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
