#!/bin/bash
set -e

echo "=========================================="
echo "TensorFlow.js 应用优化脚本"
echo "=========================================="
echo ""

# 备份原文件
echo "📦 备份原始文件..."
cp vite.config.ts vite.config.backup.ts
cp client/src/lib/faceRecognition.ts client/src/lib/faceRecognition.backup.ts
echo "✅ 备份完成"
echo ""

# 应用优化配置
echo "🔧 应用优化配置..."
cp vite.config.optimized.ts vite.config.ts
cp client/src/lib/faceRecognition.optimized.ts client/src/lib/faceRecognition.ts
echo "✅ 配置已更新"
echo ""

# 重新构建
echo "🏗️  重新构建应用..."
pnpm build
echo "✅ 构建完成"
echo ""

# 重启应用
echo "🔄 重启应用..."
pm2 restart tfjs-detection
sleep 3
echo "✅ 应用已重启"
echo ""

# 显示状态
echo "📊 当前状态:"
pm2 status
echo ""

echo "=========================================="
echo "✨ 优化完成!"
echo "=========================================="
echo ""
echo "查看日志: pm2 logs tfjs-detection"
echo "监控性能: pm2 monit"
echo ""
