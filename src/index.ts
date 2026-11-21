import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectToDatabase } from "./config/db.js";
import { errorHandler } from "./middleware/error.js";
import userRoutes, { adminUsersRouter } from "./routes/users.js";
import menuRoutes, { vendorMenuRouter, adminMenuRouter } from "./routes/menu.js";
import orderRoutes, { vendorOrdersRouter } from "./routes/orders.js";
import stripeRoutes, { adminTransactionsRouter } from "./routes/stripe.js";
import webhookRoutes from "./routes/webhook.js";
import statsRoutes from "./routes/stats.js";
import type { ApiResponse } from "./types/index.js";

dotenv.config();

export const app = express();

const clientOrigin = process.env.CLIENT_URL || "http://localhost:3000";

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === clientOrigin ||
        origin === "http://localhost:3000" ||
        origin === "http://127.0.0.1:3000"
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

app.use("/api/webhooks", webhookRoutes);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.get(
  "/api/health",
  (
    _req: Request,
    res: Response<ApiResponse<{ status: string; timestamp: string }>>
  ) => {
    res.status(200).json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
      },
    });
  }
);

app.use("/api/users", userRoutes);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/menu", menuRoutes);
app.use("/api/vendor/menu", vendorMenuRouter);
app.use("/api/admin/menu", adminMenuRouter);
app.use("/api/orders", orderRoutes);
app.use("/api/vendor/orders", vendorOrdersRouter);
app.use("/api/stripe", stripeRoutes);
app.use("/api/admin/transactions", adminTransactionsRouter);
app.use("/api/stats", statsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));

if (isMainModule && process.env.NODE_ENV !== "test") {
  connectToDatabase().catch(() => {});
  app.listen(PORT);
}
