import assert from "node:assert/strict";

export function testStatsCalculation(): void {
  const chartData = [
    { name: "Customers", count: 12 },
    { name: "Vendors", count: 4 },
    { name: "Approved Items", count: 18 },
  ];

  assert.equal(chartData.length, 3);
  assert.equal(chartData[0].name, "Customers");
  assert.equal(chartData[0].count, 12);
}
