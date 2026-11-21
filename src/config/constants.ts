import type {
  MenuItemCategory,
  MenuItemStatus,
  OrderStatus,
  UserRole,
} from "../types/index.js";

export const CATEGORIES: readonly MenuItemCategory[] = [
  "Classic Pizzas",
  "Vegetarian Pizzas",
  "Meat Lovers",
  "Specialty / Gourmet Pizzas",
  "Sides & Appetizers",
  "Beverages & Desserts",
] as const;

export const MENU_STATUSES: readonly MenuItemStatus[] = [
  "pending",
  "approved",
  "rejected",
  "inactive",
] as const;

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
] as const;

export const USER_ROLES: readonly UserRole[] = [
  "customer",
  "vendor",
  "admin",
] as const;
