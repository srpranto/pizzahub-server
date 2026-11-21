import nodemailer, { type Transporter } from "nodemailer";

interface OrderNotificationParams {
  customerEmail: string;
  customerName?: string;
  orderId: string;
  pizzaName: string;
  status: "accepted" | "rejected";
  deliveryDate: string;
  deliveryAddress: string;
  vendorName?: string;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } else {
    // Development / fallback stream transport
    cachedTransporter = nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
  }

  return cachedTransporter;
}

export async function sendOrderStatusNotificationEmail(
  params: OrderNotificationParams
): Promise<boolean> {
  const {
    customerEmail,
    customerName = "Valued Pizza Lover",
    orderId,
    pizzaName,
    status,
    deliveryDate,
    deliveryAddress,
    vendorName = "Artisan Pizzeria",
  } = params;

  if (!customerEmail || !customerEmail.includes("@")) {
    return false;
  }

  const isAccepted = status === "accepted";
  const statusTitle = isAccepted
    ? "Order Accepted & Scheduled for Stone Baking!"
    : "Order Status Update: Unable to Fulfill";
  const statusColor = isAccepted ? "#10b981" : "#ef4444";
  const statusBadge = isAccepted ? "ACCEPTED" : "DECLINED";

  const appUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const orderDetailsUrl = `${appUrl}/dashboard/customer/orders`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${statusTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #faf8f5; margin: 0; padding: 24px; color: #1c1917; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e7e5e4; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #d9381e 0%, #b82810 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 800; letter-spacing: 1px; color: #ffffff; background-color: ${statusColor}; margin-top: 12px; }
    .content { padding: 32px 24px; line-height: 1.6; }
    .details-box { background-color: #f5f5f4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e7e5e4; }
    .details-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .details-label { color: #78716c; font-weight: 500; }
    .details-val { color: #1c1917; font-weight: 700; text-align: right; }
    .cta-btn { display: inline-block; background-color: #d9381e; color: #ffffff !important; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px; margin-top: 16px; }
    .footer { padding: 20px 24px; text-align: center; font-size: 12px; color: #a8a29e; border-top: 1px solid #f5f5f4; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🍕 PizzaHub</h1>
      <div class="badge">${statusBadge}</div>
    </div>
    <div class="content">
      <h2>Hello ${customerName},</h2>
      <p>
        ${
          isAccepted
            ? `Great news! <strong>${vendorName}</strong> has accepted your pizza order and scheduled preparation in their stone oven.`
            : `We regret to inform you that <strong>${vendorName}</strong> was unable to fulfill your order request at this time.`
        }
      </p>

      <div class="details-box">
        <div class="details-row">
          <span class="details-label">Pizza Selection:</span>
          <span class="details-val">${pizzaName}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Scheduled Delivery Date:</span>
          <span class="details-val">${deliveryDate}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Delivery Destination:</span>
          <span class="details-val">${deliveryAddress}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Order Reference:</span>
          <span class="details-val">#${orderId.slice(-6).toUpperCase()}</span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${orderDetailsUrl}" class="cta-btn">View Order in Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>PizzaHub Artisanal Platform • Direct Brick-Oven Neighborhood Deliveries</p>
      <p>Questions? Contact support@pizzahub.local</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"PizzaHub Oven Updates" <notifications@pizzahub.local>',
      to: customerEmail,
      subject: isAccepted
        ? `🍕 Order Confirmed: ${pizzaName} from ${vendorName}`
        : `🍕 Update on Your PizzaHub Order: ${pizzaName}`,
      html: htmlContent,
    });

    console.log(
      `[Email Service] Dispatched order ${status} email to ${customerEmail} (messageId: ${info.messageId || "streamed"})`
    );
    return true;
  } catch (error) {
    console.error("[Email Service Error] Failed to send email notification:", error);
    return false;
  }
}
