import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// 如果 UPSTASH_REDIS_URL 未设置，创建一个模拟的 Redis 客户端
let redis;

if (process.env.UPSTASH_REDIS_URL) {
	redis = new Redis(process.env.UPSTASH_REDIS_URL);
	
	redis.on("error", (err) => {
		console.log("Redis connection error:", err.message);
	});
	
	redis.on("connect", () => {
		console.log("Redis connected successfully");
	});
} else {
	console.log("⚠️  UPSTASH_REDIS_URL not set, Redis caching disabled");
	// 创建一个模拟的 Redis 客户端，所有操作都会失败但不影响应用运行
	redis = {
		get: async () => null,
		set: async () => "OK",
		del: async () => 1,
		exists: async () => 0,
	};
}

export { redis };
