import { runMenuTests } from "./menu.test.js";
import { testVendorCapLogic } from "./vendor-cap.test.js";
import { testOrderBusinessRules } from "./order-rules.test.js";
import { testStatsCalculation } from "./stats.test.js";
import { testApiRoutes } from "./routes.test.js";

async function main(): Promise<void> {
  process.stdout.write("Running Server Tests...\n");
  try {
    await runMenuTests();
    testVendorCapLogic();
    testOrderBusinessRules();
    testStatsCalculation();
    await testApiRoutes();
    process.stdout.write("All Menu, Vendor Cap, Order Rules, Stats & API Routes Tests Passed Successfully.\n");
    process.exit(0);
  } catch (error) {
    process.stderr.write(`Test Failure: ${String(error)}\n`);
    process.exit(1);
  }
}

main();
