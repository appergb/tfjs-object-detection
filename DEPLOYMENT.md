# 部署指南

本文档提供详细的部署说明，支持多种部署方式。

## 📋 目录

- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [一键部署](#一键部署)
- [手动部署](#手动部署)
- [Docker 部署](#docker-部署)
- [生产环境配置](#生产环境配置)
- [常见问题](#常见问题)

## 🚀 快速开始

### Windows 用户

```powershell
# 使用 PowerShell 运行
.\deploy.ps1
```

### macOS / Linux 用户

```bash
chmod +x deploy.sh
./deploy.sh
```

## 💻 环境要求

### 必需软件

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **MySQL** >= 8.0（或 MariaDB >= 10.5）

### 可选软件

- **Docker** >= 20.10（用于容器化部署）
- **Docker Compose** >= 2.0
- **Git** >= 2.0

### 系统要求

- **内存**: 最低 2GB，推荐 4GB+
- **磁盘**: 最低 1GB 可用空间
- **网络**: 需要访问外网下载依赖

## 🎯 一键部署

### Windows 部署

1. **下载项目**
```powershell
git clone https://github.com/YOUR_USERNAME/tfjs-object-detection.git
cd tfjs-object-detection
```

2. **运行部署脚本**
```powershell
.\deploy.ps1
```

3. **配置数据库**

脚本会自动创建 `.env` 文件，编辑其中的数据库配置：

```env
DATABASE_URL=mysql://用户名:密码@主机:端口/数据库名
```

4. **启动应用**
```powershell
pnpm start
```

### macOS / Linux 部署

1. **下载项目**
```bash
git clone https://github.com/YOUR_USERNAME/tfjs-object-detection.git
cd tfjs-object-detection
```

2. **运行部署脚本**
```bash
chmod +x deploy.sh
./deploy.sh
```

3. **配置数据库**

编辑 `.env` 文件中的数据库配置：

```bash
nano .env
# 或使用其他编辑器
vim .env
```

4. **启动应用**
```bash
pnpm start
```

## 🔧 手动部署

### 1. 安装 Node.js

#### Windows
访问 https://nodejs.org/ 下载安装包

#### macOS
```bash
brew install node@18
```

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. 安装 pnpm

```bash
npm install -g pnpm
```

### 3. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/tfjs-object-detection.git
cd tfjs-object-detection
```

### 4. 安装依赖

```bash
pnpm install
```

### 5. 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：

```env
# 数据库配置
DATABASE_URL=mysql://root:password@localhost:3306/tfjs_detection

# JWT 密钥（生成随机密钥）
JWT_SECRET=your-random-secret-key

# 应用端口
PORT=3000
```

### 6. 初始化数据库

```bash
pnpm db:push
```

### 7. 构建项目

```bash
pnpm build
```

### 8. 启动应用

**开发模式：**
```bash
pnpm dev
```

**生产模式：**
```bash
pnpm start
```

## 🐳 Docker 部署

### 方式一：使用 Docker Compose（推荐）

这种方式会自动启动应用、MySQL 数据库和 MinIO 存储服务。

1. **配置环境变量**

创建 `.env` 文件：

```env
# MySQL 配置
MYSQL_ROOT_PASSWORD=your-root-password
MYSQL_DATABASE=tfjs_detection
MYSQL_USER=tfjs_user
MYSQL_PASSWORD=your-password

# JWT 密钥
JWT_SECRET=your-secret-key

# MinIO 配置（可选）
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=your-minio-password
```

2. **启动服务**

```bash
docker-compose up -d
```

3. **查看日志**

```bash
docker-compose logs -f app
```

4. **停止服务**

```bash
docker-compose down
```

### 方式二：仅使用 Docker

1. **构建镜像**

```bash
docker build -t tfjs-detection .
```

2. **运行容器**

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=mysql://user:password@host:3306/database \
  -e JWT_SECRET=your-secret-key \
  --name tfjs-app \
  tfjs-detection
```

3. **查看日志**

```bash
docker logs -f tfjs-app
```

## ⚙️ 生产环境配置

### 1. 数据库优化

#### MySQL 配置优化

编辑 MySQL 配置文件 `my.cnf` 或 `my.ini`：

```ini
[mysqld]
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
query_cache_size = 64M
```

#### 创建数据库用户

```sql
CREATE DATABASE tfjs_detection CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tfjs_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON tfjs_detection.* TO 'tfjs_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. 反向代理配置

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Apache 配置示例

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

### 3. SSL/HTTPS 配置

使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com
```

### 4. 进程管理

#### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start "pnpm start" --name tfjs-detection

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status

# 查看日志
pm2 logs tfjs-detection
```

#### 使用 systemd

创建服务文件 `/etc/systemd/system/tfjs-detection.service`：

```ini
[Unit]
Description=TensorFlow.js Detection App
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/tfjs-object-detection
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl enable tfjs-detection
sudo systemctl start tfjs-detection
sudo systemctl status tfjs-detection
```

### 5. 性能优化

#### 环境变量配置

```env
# 生产环境
NODE_ENV=production

# Node.js 内存限制
NODE_OPTIONS=--max-old-space-size=4096

# 启用压缩
COMPRESSION_ENABLED=true

# 缓存配置
CACHE_TTL=3600
```

#### 数据库连接池

在代码中配置连接池：

```typescript
// server/db.ts
const pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'tfjs_user',
  password: 'password',
  database: 'tfjs_detection'
});
```

### 6. 安全配置

#### 防火墙设置

```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

#### 环境变量保护

确保 `.env` 文件权限正确：

```bash
chmod 600 .env
chown www-data:www-data .env
```

## 🔍 常见问题

### Q1: 数据库连接失败

**问题：** `Error: connect ECONNREFUSED 127.0.0.1:3306`

**解决方案：**
1. 检查 MySQL 是否运行：`sudo systemctl status mysql`
2. 检查数据库配置是否正确
3. 确认数据库用户权限

### Q2: 端口被占用

**问题：** `Error: listen EADDRINUSE: address already in use :::3000`

**解决方案：**
1. 修改 `.env` 中的 `PORT` 配置
2. 或者停止占用端口的进程：
```bash
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Q3: 模型加载失败

**问题：** 前端提示"模型加载失败"

**解决方案：**
1. 检查网络连接
2. 确认 CDN 可访问（MediaPipe 模型）
3. 考虑使用本地模型文件

### Q4: 人脸识别不准确

**解决方案：**
1. 调整匹配阈值（在 `faceRecognition.ts` 中）
2. 使用更清晰的人脸照片
3. 确保光线充足

### Q5: 内存不足

**解决方案：**
1. 增加 Node.js 内存限制：
```bash
export NODE_OPTIONS=--max-old-space-size=4096
```
2. 优化数据库查询
3. 启用缓存机制

### Q6: Docker 容器无法启动

**解决方案：**
1. 查看日志：`docker-compose logs app`
2. 检查环境变量配置
3. 确认数据库容器已启动

## 📞 获取帮助

如果遇到其他问题：

1. 查看 [GitHub Issues](https://github.com/YOUR_USERNAME/tfjs-object-detection/issues)
2. 提交新的 Issue
3. 查看项目文档

## 🔄 更新应用

### Git 更新

```bash
git pull origin main
pnpm install
pnpm db:push
pnpm build
pm2 restart tfjs-detection
```

### Docker 更新

```bash
docker-compose pull
docker-compose up -d --build
```

## 📊 监控和日志

### 日志位置

- **应用日志**: `logs/app.log`
- **PM2 日志**: `~/.pm2/logs/`
- **Docker 日志**: `docker-compose logs`

### 监控工具

推荐使用：
- PM2 监控面板
- Grafana + Prometheus
- New Relic
- Datadog

---

**祝部署顺利！** 🎉

