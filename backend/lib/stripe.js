import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

let stripe;

if (process.env.STRIPE_SECRET_KEY) {
	stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
	console.log("✅ Stripe initialized successfully");
} else {
	console.log("⚠️  STRIPE_SECRET_KEY not set, Stripe payment disabled");
	stripe = null;
}

export { stripe };
