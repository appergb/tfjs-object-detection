#!/bin/bash

# TensorFlow.js 物体识别应用 - 一键部署脚本
# 支持 macOS 和 Linux

set -e

echo "=================================="
echo "TensorFlow.js 物体识别应用"
echo "一键部署脚本"
echo "=================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 打印成功消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 打印错误消息
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 打印警告消息
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 检查 Node.js
echo "检查 Node.js..."
if ! command_exists node; then
    print_error "未安装 Node.js"
    echo "请访问 https://nodejs.org/ 下载安装 Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 版本过低 (当前: $(node -v))"
    echo "请升级到 Node.js >= 18.0.0"
    exit 1
fi
print_success "Node.js $(node -v) 已安装"

# 检查 pnpm
echo "检查 pnpm..."
if ! command_exists pnpm; then
    print_warning "未安装 pnpm，正在安装..."
    npm install -g pnpm
    print_success "pnpm 安装完成"
else
    print_success "pnpm $(pnpm -v) 已安装"
fi

# 安装依赖
echo ""
echo "正在安装项目依赖..."
pnpm install
print_success "依赖安装完成"

# 检查环境变量文件
echo ""
echo "检查环境变量配置..."
if [ ! -f ".env" ]; then
    print_warning ".env 文件不存在，正在创建..."
    
    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    
    cat > .env << EOF
# 数据库配置
# 请修改为您的数据库连接信息
DATABASE_URL=mysql://root:password@localhost:3306/tfjs_detection

# JWT 密钥（已自动生成）
JWT_SECRET=${JWT_SECRET}

# OAuth 配置（可选）
# OAUTH_SERVER_URL=https://api.manus.im
# OWNER_OPEN_ID=your-owner-id

# S3 存储配置（可选）
# S3_ENDPOINT=your-s3-endpoint
# S3_BUCKET=your-bucket-name
# S3_ACCESS_KEY=your-access-key
# S3_SECRET_KEY=your-secret-key
# S3_REGION=us-east-1

# 应用配置
PORT=3000
NODE_ENV=production
EOF
    
    print_success ".env 文件已创建"
    print_warning "请编辑 .env 文件，配置数据库连接信息"
    echo ""
    echo "按 Enter 继续，或按 Ctrl+C 退出并编辑配置..."
    read
fi

# 检查数据库连接
echo ""
echo "检查数据库配置..."
if grep -q "mysql://root:password@localhost" .env; then
    print_warning "检测到默认数据库配置，请确保已修改为正确的数据库连接信息"
    echo "当前配置："
    grep "DATABASE_URL" .env
    echo ""
    echo "是否继续？(y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_error "部署已取消，请编辑 .env 文件后重新运行"
        exit 1
    fi
fi

# 初始化数据库
echo ""
echo "正在初始化数据库..."
if pnpm db:push; then
    print_success "数据库初始化完成"
else
    print_error "数据库初始化失败"
    print_warning "请检查数据库连接配置是否正确"
    exit 1
fi

# 构建项目
echo ""
echo "正在构建项目..."
if pnpm build; then
    print_success "项目构建完成"
else
    print_error "项目构建失败"
    exit 1
fi

# 完成
echo ""
echo "=================================="
print_success "部署完成！"
echo "=================================="
echo ""
echo "启动应用："
echo "  开发模式: pnpm dev"
echo "  生产模式: pnpm start"
echo ""
echo "访问地址："
echo "  http://localhost:3000"
echo ""
echo "管理功能："
echo "  1. 首次访问需要登录"
echo "  2. 管理员可在'人员管理'页面添加人员"
echo "  3. 在'物体识别'页面开始检测"
echo ""
echo "是否现在启动应用？(y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "正在启动应用..."
    pnpm start
fi

