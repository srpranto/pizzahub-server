import app from "../src/index.js";
import { connectToDatabase } from "../src/config/db.js";

connectToDatabase().catch(() => {});

export default app;
