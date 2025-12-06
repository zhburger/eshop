/**
 * EdgeOne Pages Functions 入口文件
 * 将 Express 应用适配为 EdgeOne Functions 格式
 * 
 * EdgeOne Functions 使用 Web API 标准的 Request/Response
 * 需要将 Express 应用包装成适配格式
 */

import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
//import { fileURLToPath } from "url";
import { readFileSync } from "fs";

// 导入路由
import authRoutes from "../../backend/routes/auth.route.js";
import productRoutes from "../../backend/routes/product.route.js";
import cartRoutes from "../../backend/routes/cart.route.js";
import couponRoutes from "../../backend/routes/coupon.route.js";
import paymentRoutes from "../../backend/routes/payment.route.js";
import analyticsRoutes from "../../backend/routes/analytics.route.js";

// 导入数据库连接
import { connectDB } from "../../backend/lib/db.js";

// 加载环境变量
dotenv.config();

// 获取当前文件目录
const __dirname = new URL(".", import.meta.url).pathname;
// 创建 Express 应用（不启动服务器）
const app = express();

// 中间件配置
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// API 路由
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);

// 静态文件服务（前端构建产物）
const distPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(distPath));

// SPA 路由回退（所有非 API 请求返回 index.html）
app.get("*", (req, res, next) => {
	if (req.path.startsWith("/api")) {
		return next();
	}
	const indexPath = path.join(distPath, "index.html");
	try {
		const html = readFileSync(indexPath, "utf-8");
		res.send(html);
	} catch (error) {
		next(error);
	}
});

// 初始化数据库连接（全局单例）
let dbConnected = false;
const initDB = async () => {
	if (!dbConnected) {
		try {
			await connectDB();
			dbConnected = true;
			console.log("✅ Database connected in EdgeOne Function");
		} catch (error) {
			console.error("❌ Database connection error:", error);
		}
	}
};

// 将 Web API Request 转换为 Express 请求格式
function createExpressRequest(webRequest) {
	const url = new URL(webRequest.url);
	
	// 解析 Cookie
	const cookies = {};
	const cookieHeader = webRequest.headers.get("cookie");
	if (cookieHeader) {
		cookieHeader.split(";").forEach((cookie) => {
			const [name, ...valueParts] = cookie.trim().split("=");
			if (name) {
				cookies[name] = valueParts.join("=");
			}
		});
	}

	return {
		method: webRequest.method,
		url: webRequest.url,
		path: url.pathname,
		query: Object.fromEntries(url.searchParams),
		headers: Object.fromEntries(webRequest.headers.entries()),
		cookies,
		body: null,
	};
}

// 将 Express 响应转换为 Web API Response
function createWebResponse(expressRes) {
	const headers = new Headers();
	
	// 复制响应头
	Object.entries(expressRes.headers || {}).forEach(([key, value]) => {
		if (key.toLowerCase() !== "set-cookie") {
			headers.set(key, value);
		}
	});

	// 设置 Cookie
	Object.values(expressRes.cookies || {}).forEach((cookie) => {
		headers.append("Set-Cookie", cookie);
	});

	return new Response(expressRes.body || "", {
		status: expressRes.statusCode || 200,
		headers,
	});
}

// EdgeOne Functions 入口点
export default async function onRequest(context) {
	// 初始化数据库连接
	await initDB();

	// 创建 Express 请求对象
	const req = createExpressRequest(context.request);
	
	// 创建 Express 响应对象
	const res = {
		statusCode: 200,
		headers: {},
		body: null,
		cookies: {},
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(data) {
			this.body = JSON.stringify(data);
			this.headers["Content-Type"] = "application/json";
			return this;
		},
		send(data) {
			if (typeof data === "object") {
				this.body = JSON.stringify(data);
				this.headers["Content-Type"] = "application/json";
			} else {
				this.body = data || "";
			}
			return this;
		},
		setHeader(name, value) {
			this.headers[name] = value;
			return this;
		},
		cookie(name, value, options = {}) {
			let cookieStr = `${name}=${value}`;
			if (options.maxAge) cookieStr += `; Max-Age=${options.maxAge}`;
			if (options.httpOnly) cookieStr += "; HttpOnly";
			if (options.secure) cookieStr += "; Secure";
			if (options.sameSite) cookieStr += `; SameSite=${options.sameSite}`;
			if (options.path) cookieStr += `; Path=${options.path}`;
			this.cookies[name] = cookieStr;
			return this;
		},
		clearCookie(name) {
			this.cookies[name] = `${name}=; Max-Age=0`;
			return this;
		},
	};

	// 处理请求体
	if (["POST", "PUT", "PATCH"].includes(context.request.method)) {
		try {
			const body = await context.request.text();
			if (body) {
				try {
					req.body = JSON.parse(body);
				} catch {
					req.body = body;
				}
			}
		} catch (error) {
			console.error("Error parsing request body:", error);
		}
	}

	// 调用 Express 应用
	return new Promise((resolve, reject) => {
		app(req, res, (error) => {
			if (error) {
				console.error("Express error:", error);
				resolve(
					new Response(JSON.stringify({ error: "Internal Server Error" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					})
				);
			} else {
				resolve(createWebResponse(res));
			}
		});
	});
}

