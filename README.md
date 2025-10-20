# TensorFlow.js 物体识别与人脸识别应用

基于 TensorFlow.js 的实时物体检测和人脸识别 Web 应用，支持摄像头实时检测、人员管理和识别记录查询。

## ✨ 功能特性

### 核心功能
- 🎯 **实时物体检测** - 使用 COCO-SSD 模型识别 80 种常见物体
- 👤 **人脸识别** - 基于 MediaPipe FaceMesh 进行人脸检测和特征提取
- 🔍 **人脸比对** - 自动比对数据库中的已知人员
- 📊 **识别记录** - 保存和查看历史识别记录

### 管理功能
- 👥 **人员管理** - 管理员可添加/删除人员信息
- 🔐 **用户认证** - OAuth 登录和权限管理
- 📷 **图片存储** - S3 云存储支持
- 📝 **数据库** - MySQL 数据持久化

### 界面特性
- 🎨 现代化深色主题设计
- 📱 响应式布局，支持移动端
- ⚡ 实时检测结果展示
- 🔔 友好的状态提示

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **MySQL** >= 8.0（或兼容的数据库）

### 一键部署脚本

#### Windows
```bash
# 使用 PowerShell 运行
.\deploy.ps1
```

#### macOS / Linux
```bash
# 赋予执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

### 手动安装

1. **克隆项目**
```bash
git clone https://github.com/YOUR_USERNAME/tfjs-object-detection.git
cd tfjs-object-detection
```

2. **安装依赖**
```bash
pnpm install
```

3. **配置环境变量**

复制 `.env.example` 为 `.env` 并填写配置：

```env
# 数据库配置
DATABASE_URL=mysql://user:password@localhost:3306/tfjs_detection

# JWT 密钥（自动生成或手动设置）
JWT_SECRET=your-secret-key

# OAuth 配置（可选，使用内置认证）
OAUTH_SERVER_URL=https://api.manus.im
OWNER_OPEN_ID=your-owner-id

# S3 存储配置
S3_ENDPOINT=your-s3-endpoint
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
```

4. **初始化数据库**
```bash
pnpm db:push
```

5. **启动开发服务器**
```bash
pnpm dev
```

6. **访问应用**

打开浏览器访问 http://localhost:3000

## 📦 生产部署

### 构建项目
```bash
pnpm build
```

### 启动生产服务器
```bash
pnpm start
```

### Docker 部署（推荐）

```bash
# 构建镜像
docker build -t tfjs-detection .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=your-database-url \
  --name tfjs-detection \
  tfjs-detection
```

### 使用 Docker Compose

```bash
docker-compose up -d
```

## 🛠️ 技术栈

### 前端
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **TensorFlow.js** - 机器学习
  - COCO-SSD - 物体检测
  - MediaPipe FaceMesh - 人脸检测
- **Tailwind CSS 4** - 样式框架
- **shadcn/ui** - UI 组件库
- **Wouter** - 路由管理

### 后端
- **Node.js** - 运行时
- **tRPC** - 类型安全的 API
- **Drizzle ORM** - 数据库 ORM
- **MySQL** - 数据库

### 开发工具
- **Vite** - 构建工具
- **pnpm** - 包管理器
- **ESLint** - 代码检查
- **Prettier** - 代码格式化

## 📖 使用指南

### 1. 物体检测

1. 点击"开始检测"按钮
2. 授予摄像头权限
3. 系统会自动识别画面中的物体
4. 检测结果实时显示在右侧列表

### 2. 人脸识别

**前提条件：** 需要登录并由管理员添加人员信息

1. 管理员登录后进入"人员管理"页面
2. 点击"添加人员"上传人脸照片
3. 系统自动提取人脸特征并保存
4. 在"物体识别"页面开始检测
5. 当识别到已知人员时，会显示人员姓名和置信度

### 3. 查看识别记录

1. 登录后点击"识别记录"菜单
2. 查看历史识别记录
3. 包含识别时间、人员信息、检测物体等

## 🔧 配置说明

### 数据库配置

支持 MySQL、PostgreSQL、SQLite 等数据库。修改 `drizzle.config.ts` 配置：

```typescript
export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql", // 或 "postgresql", "sqlite"
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};
```

### S3 存储配置

支持 AWS S3、MinIO、阿里云 OSS 等兼容 S3 协议的存储服务。

在 `.env` 中配置：
```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=my-bucket
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret
S3_REGION=us-east-1
```

### 人脸识别阈值调整

在 `client/src/lib/faceRecognition.ts` 中调整匹配阈值：

```typescript
// 默认阈值 0.5（50%），范围 0-1
export function matchFace(
  faceEmbedding: number[],
  knownFaces: Array<{ id: number; name: string; embedding: number[] }>,
  threshold: number = 0.5 // 调整此值
)
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 开发路线图

- [x] 基础物体检测功能
- [x] 人脸检测和识别
- [x] 用户认证和权限管理
- [x] 人员管理后台
- [x] 识别记录查询
- [ ] 批量人脸导入
- [ ] 实时视频录制
- [ ] 移动端 App
- [ ] 多语言支持
- [ ] 性能优化和模型压缩

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [TensorFlow.js](https://www.tensorflow.org/js)
- [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)
- [MediaPipe](https://google.github.io/mediapipe/)
- [shadcn/ui](https://ui.shadcn.com/)

## 📧 联系方式

如有问题或建议，请提交 Issue 或联系项目维护者。

---

**⭐ 如果这个项目对您有帮助，请给个 Star！**

