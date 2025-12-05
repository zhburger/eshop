import Coupon from "../models/coupon.model.js";
import Order from "../models/order.model.js";
import { stripe } from "../lib/stripe.js";

export const createCheckoutSession = async (req, res) => {
	try {
		// 检查 Stripe 是否已配置
		if (!stripe) {
			return res.status(503).json({ 
				error: "Payment service not configured", 
				message: "Please configure STRIPE_SECRET_KEY in .env file" 
			});
		}

		const { products, couponCode } = req.body;

		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({ error: "Invalid or empty products array" });
		}

		let totalAmount = 0;

		// 组装 Stripe line_items，金额统一用「分」
		const lineItems = products.map((product) => {
			const amount = Math.round(product.price * 100); // stripe wants u to send in the format of cents
			totalAmount += amount * product.quantity;

			return {
				price_data: {
					currency: "usd",
					product_data: {
						name: product.name,
						images: [product.image],
					},
					unit_amount: amount,
				},
				quantity: product.quantity || 1,
			};
		});

		let coupon = null;
		if (couponCode) {
			coupon = await Coupon.findOne({ code: couponCode, userId: req.user._id, isActive: true });
			if (coupon) {
				totalAmount -= Math.round((totalAmount * coupon.discountPercentage) / 100); // 百分比折扣
			}
		}

		// 创建 Checkout Session，携带元数据（用户、商品快照、优惠码）
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			line_items: lineItems,
			mode: "payment",
			success_url: `${process.env.CLIENT_URL}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.CLIENT_URL}/purchase-cancel`,
			discounts: coupon
				? [
						{
							coupon: await createStripeCoupon(coupon.discountPercentage),
						},
				  ]
				: [],
			metadata: {
				userId: req.user._id.toString(),
				couponCode: couponCode || "",
				products: JSON.stringify(
					products.map((p) => ({
						id: p._id,
						quantity: p.quantity,
						price: p.price,
					}))
				),
			},
		});

		if (totalAmount >= 20000) {
			await createNewCoupon(req.user._id);
		}
		res.status(200).json({ id: session.id, totalAmount: totalAmount / 100 });
	} catch (error) {
		console.error("Error processing checkout:", error);
		
		// 提供更友好的错误信息
		let errorMessage = "Error processing checkout";
		if (error.type === "StripeConnectionError") {
			errorMessage = "无法连接到支付服务，请检查网络连接或联系管理员";
		} else if (error.type === "StripeAuthenticationError") {
			errorMessage = "支付服务配置错误，请检查 STRIPE_SECRET_KEY";
		} else if (error.message) {
			errorMessage = error.message;
		}
		
		res.status(500).json({ 
			message: errorMessage, 
			error: error.message,
			type: error.type || "UnknownError"
		});
	}
};

export const checkoutSuccess = async (req, res) => {
	try {
		// 检查 Stripe 是否已配置
		if (!stripe) {
			return res.status(503).json({ 
				error: "Payment service not configured", 
				message: "Please configure STRIPE_SECRET_KEY in .env file" 
			});
		}

		const { sessionId } = req.body;
		const session = await stripe.checkout.sessions.retrieve(sessionId); // 二次向 Stripe 确认支付状态

		if (session.payment_status === "paid") {
			if (session.metadata.couponCode) {
				await Coupon.findOneAndUpdate(
					{
						code: session.metadata.couponCode,
						userId: session.metadata.userId,
					},
					{
						isActive: false,
					}
				);
			}

			// create a new Order
			const products = JSON.parse(session.metadata.products);
			const newOrder = new Order({
				user: session.metadata.userId,
				products: products.map((product) => ({
					product: product.id,
					quantity: product.quantity,
					price: product.price,
				})),
				totalAmount: session.amount_total / 100, // convert from cents to dollars,
				stripeSessionId: sessionId,
			});

			await newOrder.save(); // 将支付结果落地到订单集合

			res.status(200).json({
				success: true,
				message: "Payment successful, order created, and coupon deactivated if used.",
				orderId: newOrder._id,
			});
	}
	} catch (error) {
		console.error("Error processing successful checkout:", error);
		
		let errorMessage = "Error processing successful checkout";
		if (error.type === "StripeConnectionError") {
			errorMessage = "无法连接到支付服务，请检查网络连接";
		} else if (error.message) {
			errorMessage = error.message;
		}
		
		res.status(500).json({ 
			message: errorMessage, 
			error: error.message,
			type: error.type || "UnknownError"
		});
	}
};

async function createStripeCoupon(discountPercentage) {
	if (!stripe) {
		throw new Error("Stripe not configured");
	}
	
	const coupon = await stripe.coupons.create({
		percent_off: discountPercentage,
		duration: "once",
	});

	return coupon.id;
}

async function createNewCoupon(userId) {
	await Coupon.findOneAndDelete({ userId });

	const newCoupon = new Coupon({
		code: "GIFT" + Math.random().toString(36).substring(2, 8).toUpperCase(),
		discountPercentage: 10,
		expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
		userId: userId,
	});

	await newCoupon.save();

	return newCoupon;
}
