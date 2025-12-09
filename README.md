# E-Commerce Store 项目说明

## 学号：202330452341

## 姓名：张瀚

## 部署地址

-https://eshop-app.zeabur.app/

## 目录结构（简版）

- `backend/`
  - `server.js`：Express 入口，挂载路由，生产模式托管前端
  - `controllers/`：业务控制器（auth、product、cart、coupon、payment、analytics 等）
  - `models/`：Mongoose 模型（user、product、order、coupon）
  - `lib/`：外部服务封装（db、redis、cloudinary、stripe）
  - `routes/`：路由定义，对应各控制器
  - `middleware/`：鉴权中间件
- `frontend/`
  - `vite.config.js`：开发代理配置
  - `src/lib/axios.js`：Axios 实例，开发指向 `http://localhost:5000/api`
  - `src/components/`：UI 组件（商品卡片、结算、分析等）
  - `src/pages/`：页面（登录注册等）
  - `src/stores/`：Zustand 状态（用户、购物车、商品）
- `package.json`：根脚本（build/start/dev），build 会同时安装并构建前端

## 环境变量（根目录 `.env` 示例）

```
仅用于本地运行
PORT=5000
MONGO_URI=your_mongo_uri
UPSTASH_REDIS_URL=your_redis_url
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

## 启动与构建

在项目根目录运行：

```bash
# 1) 安装依赖
npm install
cd frontend && npm install && cd ..

# 2) 开发模式（前后端分开跑）
npm run dev           # 启动后端 http://localhost:5000
cd frontend && npm run dev  # 启动前端 http://localhost:5173

# 3) 生产构建与启动（前端会被构建并由后端托管）
npm run build
npm start
```

## 说明

- 开发环境前端通过 Vite 代理调用后端 `/api`。
- 生产模式下，后端会静态托管 `frontend/dist`。

---

## 🚀 Zeabur 部署指南

### 部署方案：

-连接代码仓 -编写必需环境变量 -根据项目启动指令编写 dockerfile -部署

---
