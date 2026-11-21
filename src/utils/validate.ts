import { ObjectId, type Document } from "mongodb";
import type {
  MenuItemWithVendor,
  MenuItemCategory,
  MenuItemStatus,
  OrderWithDetails,
  OrderStatus,
  OrderStatusHistoryItem,
  TransactionWithVendor,
  SubscriptionPlan,
} from "../types/index.js";

export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== "string") {
    return false;
  }
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
}

export function toObjectId(id: string): ObjectId {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ObjectId format: ${id}`);
  }
  return new ObjectId(id);
}

export function isValidIsoDate(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }
  const timestamp = Date.parse(dateString);
  return !Number.isNaN(timestamp);
}

export function toMenuItemResponse(
  doc: Record<string, unknown> | Document
): MenuItemWithVendor {
  const objId =
    doc._id instanceof ObjectId
      ? doc._id
      : new ObjectId(String(doc._id ?? new ObjectId()));
  const vId =
    doc.vendorId instanceof ObjectId
      ? doc.vendorId.toString()
      : String(doc.vendorId ?? "");

  return {
    id: objId.toString(),
    _id: objId,
    vendorId: vId,
    itemName: String(doc.itemName ?? ""),
    category: doc.category as MenuItemCategory,
    description: String(doc.description ?? ""),
    price: Number(doc.price ?? 0),
    location: String(doc.location ?? ""),
    images: Array.isArray(doc.images) ? (doc.images as string[]) : [],
    status: (doc.status as MenuItemStatus) ?? "pending",
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt
        : new Date(String(doc.createdAt ?? Date.now())),
    updatedAt: doc.updatedAt
      ? doc.updatedAt instanceof Date
        ? doc.updatedAt
        : new Date(String(doc.updatedAt))
      : undefined,
    vendorName:
      typeof doc.vendorName === "string" ? doc.vendorName : undefined,
    vendorPlan:
      typeof doc.vendorPlan === "string"
        ? (doc.vendorPlan as SubscriptionPlan)
        : undefined,
    isPremiumVendor:
      typeof doc.isPremiumVendor === "number"
        ? doc.isPremiumVendor
        : undefined,
    vendorEmail:
      typeof doc.vendorEmail === "string" ? doc.vendorEmail : undefined,
  };
}

export function toOrderResponse(
  doc: Record<string, unknown> | Document
): OrderWithDetails {
  const objId =
    doc._id instanceof ObjectId
      ? doc._id
      : new ObjectId(String(doc._id ?? new ObjectId()));
  const itemId =
    doc.itemId instanceof ObjectId
      ? doc.itemId.toString()
      : String(doc.itemId ?? "");
  const vendorId =
    doc.vendorId instanceof ObjectId
      ? doc.vendorId.toString()
      : String(doc.vendorId ?? "");
  const customerId =
    doc.customerId instanceof ObjectId
      ? doc.customerId.toString()
      : String(doc.customerId ?? "");
  const statusHistory = Array.isArray(doc.statusHistory)
    ? (doc.statusHistory as OrderStatusHistoryItem[])
    : [];
  const rawItem =
    doc.item && typeof doc.item === "object"
      ? (doc.item as Record<string, unknown>)
      : null;

  return {
    id: objId.toString(),
    _id: objId,
    itemId,
    vendorId,
    customerId,
    deliveryDate: String(doc.deliveryDate ?? ""),
    deliveryAddress: String(doc.deliveryAddress ?? ""),
    message: typeof doc.message === "string" ? doc.message : undefined,
    quantity: typeof doc.quantity === "number" ? doc.quantity : 1,
    status: (doc.status as OrderStatus) ?? "pending",
    statusHistory,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt
        : new Date(String(doc.createdAt ?? Date.now())),
    item: rawItem ? toMenuItemResponse(rawItem) : null,
    vendorName:
      typeof doc.vendorName === "string" ? doc.vendorName : undefined,
    customerName:
      typeof doc.customerName === "string" ? doc.customerName : undefined,
    customerEmail:
      typeof doc.customerEmail === "string" ? doc.customerEmail : undefined,
  };
}

export function toTransactionResponse(
  doc: Record<string, unknown> | Document
): TransactionWithVendor {
  const objId =
    doc._id instanceof ObjectId
      ? doc._id
      : new ObjectId(String(doc._id ?? new ObjectId()));
  const vendorId =
    doc.vendorId instanceof ObjectId
      ? doc.vendorId.toString()
      : String(doc.vendorId ?? "");

  return {
    id: objId.toString(),
    _id: objId,
    vendorId,
    plan: "premium",
    amount: Number(doc.amount ?? 0),
    currency: String(doc.currency ?? "usd"),
    stripeSessionId: String(doc.stripeSessionId ?? ""),
    stripeSubscriptionId:
      typeof doc.stripeSubscriptionId === "string"
        ? doc.stripeSubscriptionId
        : null,
    status: String(doc.status ?? "succeeded"),
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt
        : new Date(String(doc.createdAt ?? Date.now())),
    vendorName:
      typeof doc.vendorName === "string" ? doc.vendorName : undefined,
    vendorEmail:
      typeof doc.vendorEmail === "string" ? doc.vendorEmail : undefined,
  };
}
