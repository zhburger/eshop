import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";

// 仪表盘概览：统计用户总数、商品总数，以及订单总量与总营收
export const getAnalyticsData = async () => {
	const totalUsers = await User.countDocuments(); // 直接计数集合
	const totalProducts = await Product.countDocuments();

	// 按全部订单聚合，统计订单数和营收和
	const salesData = await Order.aggregate([
		{
			$group: {
				_id: null, // 不分组字段，汇总全部
				totalSales: { $sum: 1 }, // 订单数量
				totalRevenue: { $sum: "$totalAmount" }, // 金额累加
			},
		},
	]);

	const { totalSales, totalRevenue } = salesData[0] || { totalSales: 0, totalRevenue: 0 };

	return {
		users: totalUsers,
		products: totalProducts,
		totalSales,
		totalRevenue,
	};
};

// 按日统计销售与营收，填补空档日期
export const getDailySalesData = async (startDate, endDate) => {
	try {
		// 先用 Mongo 聚合得到已存在的日期汇总
		const dailySalesData = await Order.aggregate([
			{
				$match: {
					createdAt: {
						$gte: startDate,
						$lte: endDate,
					},
				},
			},
			{
				$group: {
					_id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, // 日期字符串
					sales: { $sum: 1 }, // 订单数
					revenue: { $sum: "$totalAmount" }, // 当日营收
				},
			},
			{ $sort: { _id: 1 } },
		]);

		// example of dailySalesData
		// [
		// 	{
		// 		_id: "2024-08-18",
		// 		sales: 12,
		// 		revenue: 1450.75
		// 	},
		// ]

		const dateArray = getDatesInRange(startDate, endDate); // 补齐时间段内所有日期
		// console.log(dateArray) // ['2024-08-18', '2024-08-19', ... ]

		return dateArray.map((date) => {
			// 对每个日期查是否有聚合结果，缺省填 0
			const foundData = dailySalesData.find((item) => item._id === date);

			return {
				date,
				sales: foundData?.sales || 0,
				revenue: foundData?.revenue || 0,
			};
		});
	} catch (error) {
		throw error;
	}
};

// 生成闭区间日期数组（字符串形式），用于补齐空档
function getDatesInRange(startDate, endDate) {
	const dates = [];
	let currentDate = new Date(startDate);

	while (currentDate <= endDate) {
		dates.push(currentDate.toISOString().split("T")[0]);
		currentDate.setDate(currentDate.getDate() + 1);
	}

	return dates;
}
