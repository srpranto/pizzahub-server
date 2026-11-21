import type { Request } from "express";
import type { ObjectId } from "mongodb";

export type UserRole = "customer" | "vendor" | "admin";
export type SubscriptionPlan = "free" | "premium";
export type MenuItemCategory =
  | "Classic Pizzas"
  | "Vegetarian Pizzas"
  | "Meat Lovers"
  | "Specialty / Gourmet Pizzas"
  | "Sides & Appetizers"
  | "Beverages & Desserts";
export type MenuItemStatus = "pending" | "approved" | "rejected" | "inactive";
export type OrderStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface DbUser {
  _id: ObjectId;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  isBlocked: boolean;
  businessName?: string | null;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt: Date | null;
  favoriteItemIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DbMenuItem {
  _id: ObjectId;
  vendorId: ObjectId;
  itemName: string;
  category: MenuItemCategory;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: MenuItemStatus;
  createdAt: Date;
  updatedAt?: Date;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  at: Date;
}

export interface DbOrder {
  _id: ObjectId;
  itemId: ObjectId;
  vendorId: ObjectId;
  customerId: ObjectId;
  deliveryDate: string;
  deliveryAddress: string;
  message?: string;
  quantity?: number;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryItem[];
  createdAt: Date;
}

export interface DbReview {
  _id: ObjectId;
  itemId: ObjectId;
  vendorId: ObjectId;
  customerId: ObjectId;
  customerName: string;
  customerImage?: string | null;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface DbTransaction {
  _id: ObjectId;
  vendorId: ObjectId;
  plan: "premium";
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string | null;
  status: string;
  createdAt: Date;
}

export interface AuthenticatedUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
  businessName: string | null;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt: Date | null;
  favoriteItemIds: string[];
  image: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface MenuItemWithVendor {
  id: string;
  vendorId: string;
  itemName: string;
  category: MenuItemCategory;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: MenuItemStatus;
  createdAt: Date;
  updatedAt?: Date;
  vendorName?: string;
  vendorPlan?: SubscriptionPlan;
  isPremiumVendor?: number;
  vendorEmail?: string;
  _id?: ObjectId | string;
}

export interface OrderWithDetails {
  id: string;
  itemId: string;
  vendorId: string;
  customerId: string;
  deliveryDate: string;
  deliveryAddress: string;
  message?: string;
  quantity?: number;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryItem[];
  createdAt: Date;
  item?: MenuItemWithVendor | null;
  vendorName?: string;
  customerName?: string;
  customerEmail?: string;
  _id?: ObjectId | string;
}

export interface TransactionWithVendor {
  id: string;
  vendorId: string;
  plan: "premium";
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string | null;
  status: string;
  createdAt: Date;
  vendorName?: string;
  vendorEmail?: string;
  _id?: ObjectId | string;
}

export interface ReviewResponse {
  id: string;
  itemId: string;
  vendorId: string;
  customerId: string;
  customerName: string;
  customerImage?: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ItemReviewsSummary {
  reviews: ReviewResponse[];
  averageRating: number;
  totalReviews: number;
}

export interface CustomerStats {
  totalOrders: number;
  pendingOrders: number;
  acceptedOrders: number;
  cancelledOrders: number;
  chartData: Array<{ name: string; count: number }>;
}

export interface VendorStats {
  totalItems: number;
  approvedItems: number;
  pendingItems: number;
  totalOrders: number;
  pendingOrders: number;
  acceptedOrders: number;
  subscriptionPlan: SubscriptionPlan;
  chartData: Array<{ name: string; count: number }>;
}

export interface AdminStats {
  totalUsers: number;
  totalVendors: number;
  totalCustomers: number;
  totalItems: number;
  pendingItems: number;
  approvedItems: number;
  totalOrders: number;
  totalTransactions: number;
  chartData: Array<{ name: string; count: number }>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
