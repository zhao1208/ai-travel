# OAuth 登录配置指南

## Google OAuth 配置

### 1. 创建 Google Cloud 项目
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "Google+ API"

### 2. 创建 OAuth 凭据
1. 进入 "APIs & Services" > "Credentials"
2. 点击 "Create Credentials" > "OAuth client ID"
3. 应用类型选择 "Web application"
4. 添加授权重定向 URI：
   - 开发环境: `http://localhost:3000/auth/google/callback`
   - 生产环境: `https://yourdomain.com/auth/google/callback`
5. 记录 Client ID 和 Client Secret

### 3. 配置环境变量
在 `.env` 文件中添加：
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 微信 OAuth 配置

### 1. 注册微信开放平台账号
1. 访问 [微信开放平台](https://open.weixin.qq.com/)
2. 注册并认证开发者账号
3. 创建网站应用

### 2. 获取 AppID 和 AppSecret
1. 在管理中心找到你的应用
2. 记录 AppID 和 AppSecret
3. 设置授权回调域：
   - 开发环境: `localhost`
   - 生产环境: `yourdomain.com`

### 3. 配置环境变量
在 `.env` 文件中添加：
```bash
WECHAT_APP_ID=your-wechat-appid
WECHAT_APP_SECRET=your-wechat-appsecret
```

---

## 启动应用

### 方式一：使用 .env 文件
1. 复制 `.env.example` 为 `.env`
2. 填入你的 OAuth 凭据
3. 运行 `npm start`

### 方式二：直接设置环境变量
```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export WECHAT_APP_ID="your-appid"
export WECHAT_APP_SECRET="your-appsecret"
npm start
```

---

## 测试 OAuth 登录

1. 启动应用后访问 http://localhost:3000
2. 点击登录/注册页面
3. 点击 "Google" 或 "微信" 按钮
4. 完成 OAuth 授权流程
5. 成功后会自动跳转回首页并显示登录状态

---

## 注意事项

- **开发环境**: 可以使用 localhost 进行测试
- **生产环境**: 必须使用 HTTPS
- **安全性**: 不要将 `.env` 文件提交到版本控制系统
- **会话密钥**: 在生产环境中务必修改 `SESSION_SECRET`
