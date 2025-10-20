# 贡献指南

感谢您考虑为 TensorFlow.js 物体识别与人脸识别应用做出贡献! 🎉

## 行为准则

请遵守我们的行为准则,保持友好和尊重的交流环境。

## 如何贡献

### 报告 Bug

如果您发现了 Bug,请:

1. 检查 [Issues](https://github.com/appergb/tfjs-object-detection/issues) 确保该问题尚未被报告
2. 使用 Bug 报告模板创建新的 Issue
3. 提供详细的复现步骤和环境信息
4. 如果可能,提供错误日志和截图

### 提出功能请求

如果您有新功能的想法:

1. 检查 [Issues](https://github.com/appergb/tfjs-object-detection/issues) 确保该功能尚未被提出
2. 使用功能请求模板创建新的 Issue
3. 详细描述功能的用途和使用场景
4. 如果可能,提供设计草图或示例

### 提交代码

#### 开发流程

1. **Fork 项目**
   ```bash
   # 在 GitHub 上 Fork 项目
   git clone https://github.com/YOUR_USERNAME/tfjs-object-detection.git
   cd tfjs-object-detection
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **安装依赖**
   ```bash
   pnpm install
   ```

4. **开发和测试**
   ```bash
   # 启动开发服务器
   pnpm dev
   
   # 运行测试
   pnpm test
   
   # 检查代码格式
   pnpm format
   ```

5. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能"
   # 或
   git commit -m "fix: 修复某个 Bug"
   ```

6. **推送到 GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 在 GitHub 上创建 Pull Request
   - 填写 PR 模板
   - 等待代码审查

#### 提交信息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范:

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式调整 (不影响功能)
- `refactor:` 代码重构
- `perf:` 性能优化
- `test:` 测试相关
- `chore:` 构建或辅助工具的变动

示例:
```
feat: 添加批量人脸导入功能
fix: 修复人脸识别阈值计算错误
docs: 更新部署文档
perf: 优化物体检测性能
```

#### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 添加必要的注释
- 编写清晰的变量和函数名

#### 测试要求

- 新功能需要添加测试
- Bug 修复需要添加回归测试
- 确保所有测试通过

### 文档贡献

文档同样重要! 您可以:

- 修正文档中的错误
- 改进文档的清晰度
- 添加使用示例
- 翻译文档

## 开发环境设置

### 必需软件

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- MySQL >= 8.0

### 推荐工具

- VS Code
- ESLint 扩展
- Prettier 扩展
- TypeScript 扩展

### 环境配置

1. 复制环境变量文件:
   ```bash
   cp .env.example .env
   ```

2. 配置数据库连接

3. 初始化数据库:
   ```bash
   pnpm db:push
   ```

## 项目结构

```
tfjs-object-detection/
├── client/              # 前端代码
│   ├── src/
│   │   ├── pages/      # 页面组件
│   │   ├── components/ # UI 组件
│   │   └── lib/        # 工具库
│   └── public/         # 静态资源
├── server/             # 后端代码
│   └── _core/         # 核心服务
├── drizzle/           # 数据库 Schema
└── docs/              # 文档
```

## 代码审查流程

1. 提交 Pull Request
2. 自动运行 CI 检查
3. 至少一位维护者审查代码
4. 根据反馈修改代码
5. 审查通过后合并

## 发布流程

维护者负责发布新版本:

1. 更新 CHANGELOG.md
2. 更新版本号
3. 创建 Git 标签
4. 发布 GitHub Release

## 需要帮助?

- 查看 [文档](./README.md)
- 在 [Issues](https://github.com/appergb/tfjs-object-detection/issues) 中提问
- 查看 [常见问题](./DEPLOYMENT_SUMMARY.md)

## 许可证

通过贡献代码,您同意您的贡献将在 MIT 许可证下发布。

---

再次感谢您的贡献! 🙏

