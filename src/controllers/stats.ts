import type { Response, NextFunction } from "express";
import {
  getOrdersCollection,
  getMenuItemsCollection,
  getUsersCollection,
  getTransactionsCollection,
} from "../config/db.js";
import { toObjectId } from "../utils/validate.js";
import type {
  AuthenticatedRequest,
  ApiResponse,
  CustomerStats,
  VendorStats,
  AdminStats,
} from "../types/index.js";

export async function getCustomerStats(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<CustomerStats>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const customerObjectId = toObjectId(req.user._id);
    const ordersCollection = getOrdersCollection();

    const [totalOrders, pendingOrders, acceptedOrders, cancelledOrders] =
      await Promise.all([
        ordersCollection.countDocuments({ customerId: customerObjectId }),
        ordersCollection.countDocuments({
          customerId: customerObjectId,
          status: "pending",
        }),
        ordersCollection.countDocuments({
          customerId: customerObjectId,
          status: "accepted",
        }),
        ordersCollection.countDocuments({
          customerId: customerObjectId,
          status: "cancelled",
        }),
      ]);

    const chartData = [
      { name: "Pending", count: pendingOrders },
      { name: "Accepted", count: acceptedOrders },
      { name: "Cancelled", count: cancelledOrders },
    ];

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        acceptedOrders,
        cancelledOrders,
        chartData,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getVendorStats(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<VendorStats>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const vendorObjectId = toObjectId(req.user._id);
    const menuCollection = getMenuItemsCollection();
    const ordersCollection = getOrdersCollection();

    const [totalItems, approvedItems, pendingItems, totalOrders, pendingOrders, acceptedOrders] =
      await Promise.all([
        menuCollection.countDocuments({ vendorId: vendorObjectId }),
        menuCollection.countDocuments({
          vendorId: vendorObjectId,
          status: "approved",
        }),
        menuCollection.countDocuments({
          vendorId: vendorObjectId,
          status: "pending",
        }),
        ordersCollection.countDocuments({ vendorId: vendorObjectId }),
        ordersCollection.countDocuments({
          vendorId: vendorObjectId,
          status: "pending",
        }),
        ordersCollection.countDocuments({
          vendorId: vendorObjectId,
          status: "accepted",
        }),
      ]);

    const chartData = [
      { name: "Approved Items", count: approvedItems },
      { name: "Pending Items", count: pendingItems },
      { name: "Orders Fulfilled", count: acceptedOrders },
      { name: "Pending Orders", count: pendingOrders },
    ];

    res.status(200).json({
      success: true,
      data: {
        totalItems,
        approvedItems,
        pendingItems,
        totalOrders,
        pendingOrders,
        acceptedOrders,
        subscriptionPlan: req.user.subscriptionPlan,
        chartData,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminStats(
  _req: AuthenticatedRequest,
  res: Response<ApiResponse<AdminStats>>,
  next: NextFunction
): Promise<void> {
  try {
    const usersCollection = getUsersCollection();
    const menuCollection = getMenuItemsCollection();
    const ordersCollection = getOrdersCollection();
    const transactionsCollection = getTransactionsCollection();

    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalItems,
      pendingItems,
      approvedItems,
      totalOrders,
      totalTransactions,
    ] = await Promise.all([
      usersCollection.countDocuments(),
      usersCollection.countDocuments({ role: "vendor" }),
      usersCollection.countDocuments({ role: "customer" }),
      menuCollection.countDocuments(),
      menuCollection.countDocuments({ status: "pending" }),
      menuCollection.countDocuments({ status: "approved" }),
      ordersCollection.countDocuments(),
      transactionsCollection.countDocuments(),
    ]);

    const chartData = [
      { name: "Customers", count: totalCustomers },
      { name: "Vendors", count: totalVendors },
      { name: "Approved Items", count: approvedItems },
      { name: "Pending Items", count: pendingItems },
      { name: "Orders", count: totalOrders },
      { name: "Transactions", count: totalTransactions },
    ];

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalItems,
        pendingItems,
        approvedItems,
        totalOrders,
        totalTransactions,
        chartData,
      },
    });
  } catch (error) {
    next(error);
  }
}
