import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY ||
  "sk_test_placeholder_key_for_build_and_local_dev";

export const stripe = new Stripe(stripeSecretKey, {
  typescript: true,
});
