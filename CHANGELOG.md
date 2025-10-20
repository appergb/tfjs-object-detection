# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-20

### Added
- ✨ 实现本地认证系统,替代OAuth认证
- ✨ 添加用户名/密码登录功能
- ✨ 创建独立的登录页面 (Login.tsx)
- ✨ 人脸检测黄色边框显示
- ✨ 人脸识别姓名标注(已识别/未知)
- ✨ 红色角标装饰效果
- ✨ 默认管理员账户(LBX/198305)
- 📝 添加详细的部署说明文档
- 📝 创建代码规范文档 (CODE_STANDARDS.md)
- 📝 添加项目重构计划 (REFACTOR_PLAN.md)

### Improved
- 🎨 优化移动端响应式布局
- 🎨 调整卡片间距和padding
- 🎨 优化按钮尺寸适配移动设备
- 🎨 改进标题和文字大小
- 🎨 移动端内容显示顺序优化
- 🔧 使用bcryptjs进行密码哈希加密
- 🔧 实现JWT会话管理
- 🗃️ 数据库添加password字段
- 🔒 安全性加固(密码加密、会话管理)

### Fixed
- 🐛 修复未知人脸不显示的问题
- 🐛 修复数据库为空时人脸检测不执行的bug
- 🐛 修复OAuth认证IP白名单限制问题
- 🐛 修复置信度显示不正确的问题

### Removed
- 🗑️ 移除OAuth第三方认证依赖
- 🗑️ 移除外部认证服务器配置

### Breaking Changes
- ⚠️ 认证系统从 OAuth 变更为本地认证
- ⚠️ 需要重新配置用户账户

## [1.1.0] - 2025-10-20

### Added
- 完整的部署文档 (`DEPLOYMENT_SUMMARY.md`)
- 性能优化指南 (`OPTIMIZATION_GUIDE.md`)
- 项目统计信息 (`PROJECT_STATS.txt`)
- PM2 生产环境配置文件 (`ecosystem.config.cjs`)
- 一键优化脚本 (`apply-optimizations.sh`)
- 优化版 Vite 配置 (`vite.config.optimized.ts`)
- 优化版人脸识别算法 (`client/src/lib/faceRecognition.optimized.ts`)

### Improved
- **前端构建优化**
  - 实现代码分割,将 TensorFlow.js、React、UI 组件分离
  - 启用 Terser 压缩,移除生产环境 console
  - 优化依赖预构建配置
  - 预期 JS 包大小减少 40-50% (2.5MB → 1.2-1.5MB)
  - 预期初始加载时间减少 50% (3-5s → 1.5-2.5s)

- **人脸识别性能优化**
  - 实现单例模式和初始化锁,避免重复加载模型
  - 添加缓存机制 (100ms TTL),减少重复计算
  - 特征向量降维 (200+ → 50 维)
  - 优化关键点筛选,只使用 16 个关键特征点
  - 简化距离计算算法
  - 预期识别速度提升 50-70% (300-500ms → 100-200ms)
  - 预期内存占用减少 20% (200-300MB → 150-200MB)

- **部署流程优化**
  - 添加 PM2 进程管理配置
  - 支持开机自启动
  - 完善日志管理
  - 添加一键优化脚本

### Documentation
- 新增完整的部署指南
- 新增性能优化文档
- 新增故障排查手册
- 新增运维管理指南
- 改进 README 文档

### Performance
- 初始加载时间优化: 预期提升 50%
- JS 包大小优化: 预期减少 40%
- 人脸识别延迟优化: 预期提升 60%
- 内存占用优化: 预期减少 30%
- CPU 使用率优化: 预期降低 35%

## [1.0.0] - 2025-10-19

### Added
- 实时物体检测功能 (COCO-SSD)
- 人脸识别功能 (MediaPipe FaceMesh)
- 人员管理功能
- 识别记录查询
- 用户认证 (OAuth)
- 统计数据展示
- 响应式 UI 设计
- 深色主题

### Technical Stack
- React 19
- TypeScript
- TensorFlow.js 4.22.0
- Express 4.21.2
- Drizzle ORM
- MySQL 8.0
- Tailwind CSS 4
- shadcn/ui

[1.1.0]: https://github.com/appergb/tfjs-object-detection/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/appergb/tfjs-object-detection/releases/tag/v1.0.0

