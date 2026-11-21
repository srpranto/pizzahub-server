import { MongoClient, Db, Collection } from "mongodb";
import dotenv from "dotenv";
import type { DbUser, DbMenuItem, DbOrder, DbTransaction, DbReview } from "../types/index.js";

dotenv.config();

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pizzahub";
const DB_NAME = process.env.DB_NAME || process.env.MONGODB_DB_NAME || "pizzahub";

export async function initDatabaseIndexes(db: Db): Promise<void> {
  try {
    const users = db.collection<DbUser>("users");
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ role: 1 });
    await users.createIndex({ isBlocked: 1 });

    const menuItems = db.collection<DbMenuItem>("menuItems");
    await menuItems.createIndex({ status: 1 });
    await menuItems.createIndex({ category: 1 });
    await menuItems.createIndex({ location: 1 });
    await menuItems.createIndex({ price: 1 });
    await menuItems.createIndex({ vendorId: 1 });

    const orders = db.collection<DbOrder>("orders");
    await orders.createIndex({ customerId: 1 });
    await orders.createIndex({ vendorId: 1 });
    await orders.createIndex({ itemId: 1 });
    await orders.createIndex({
      customerId: 1,
      itemId: 1,
      deliveryDate: 1,
      status: 1,
    });

    const transactions = db.collection<DbTransaction>("transactions");
    await transactions.createIndex({ vendorId: 1 });
    await transactions.createIndex({ stripeSessionId: 1 }, { unique: true });

    const reviews = db.collection<DbReview>("reviews");
    await reviews.createIndex({ itemId: 1 });
    await reviews.createIndex({ vendorId: 1 });
    await reviews.createIndex({ customerId: 1, itemId: 1 }, { unique: true });
  } catch {
  }
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = cachedClient ?? new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  await initDatabaseIndexes(db);

  return { client, db };
}

export function getDatabase(): Db {
  if (!cachedDb) {
    if (!cachedClient) {
      cachedClient = new MongoClient(MONGODB_URI);
    }
    cachedDb = cachedClient.db(DB_NAME);
  }
  return cachedDb;
}

export function setDatabase(db: Db | null): void {
  cachedDb = db;
}

export function getUsersCollection(): Collection<DbUser> {
  return getDatabase().collection<DbUser>("users");
}

export function getMenuItemsCollection(): Collection<DbMenuItem> {
  return getDatabase().collection<DbMenuItem>("menuItems");
}

export function getOrdersCollection(): Collection<DbOrder> {
  return getDatabase().collection<DbOrder>("orders");
}

export function getTransactionsCollection(): Collection<DbTransaction> {
  return getDatabase().collection<DbTransaction>("transactions");
}

export function getReviewsCollection(): Collection<DbReview> {
  return getDatabase().collection<DbReview>("reviews");
}
