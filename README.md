# AI Travel Assistant - PHP + MySQL Version

AI旅行助手，支持部署到 PHP + MySQL 云虚拟主机。

## 功能特性

- AI智能对话（支持LLM API或内置回复）
- 中英文翻译（支持拼音显示）
- 旅行常用短语库
- 城市探索指南
- 管理后台（模型配置、提示词管理）
- 用户注册/登录系统
- 响应式设计，支持移动端

## 部署到云虚拟主机

### 1. 上传文件

将所有文件上传到虚拟主机的网站根目录（通常是 `public_html` 或 `www`）。

### 2. 配置数据库

编辑 `api/config.php`，填入你的 MySQL 数据库信息：

```php
define('DB_HOST', 'localhost');      // 数据库主机
define('DB_NAME', 'travelmate');     // 数据库名
define('DB_USER', 'your_username');  // 数据库用户名
define('DB_PASS', 'your_password');  // 数据库密码
```

### 3. 初始化数据库

浏览器访问一次初始化接口，自动创建数据表：

```
https://你的域名/api/init.php
```

看到 `{"success":true,"message":"Database initialized successfully"}` 表示成功。

### 4. 开始使用

- 首页：`https://你的域名/`
- 默认管理员：`admin@travelmate.com` / `admin123`

### 5. 配置AI（可选）

如需使用真实AI回复，设置环境变量或在服务器配置中添加：

```
LLM_API_KEY=your-api-key
LLM_API_URL=https://api.xiaomimimo.com/v1/chat/completions
LLM_MODEL=mimo-v2-flash
```

## 本地开发

```bash
# 启动PHP开发服务器
php -S localhost:3000

# 初始化数据库
curl http://localhost:3000/api/init.php
```

## 文件结构

```
├── api/                    # PHP后端API
│   ├── config.php          # 数据库配置
│   ├── init.php            # 数据库初始化
│   ├── health.php          # 健康检查
│   ├── auth.php            # 用户认证
│   ├── admin.php           # 管理后台
│   ├── chat.php            # 聊天API
│   └── translate.php       # 翻译API
├── public/                 # 前端静态文件
│   ├── index.html          # 入口页面
│   ├── css/style.css       # 样式文件
│   └── js/
│       ├── app.js          # 主应用逻辑
│       └── i18n.js         # 国际化
├── .htaccess               # URL重写
└── README.md               # 项目文档
```

## 数据库表结构

- `users` - 用户账户
- `ai_models` - AI模型配置
- `prompts` - 提示词管理
- `chat_history` - 聊天记录

## 技术栈

- **前端**: HTML5, CSS3, Vanilla JavaScript
- **后端**: PHP 7.4+, MySQL 5.7+
- **认证**: PHP Session

## License

MIT
