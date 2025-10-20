#!/bin/bash

# TensorFlow.js 物体识别与人脸识别应用 - 增强版一键部署脚本
# 支持 macOS 和 Linux 系统
# 版本: 1.1.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}=========================================="
    echo "$1"
    echo -e "==========================================${NC}"
    echo ""
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Node.js 版本
check_node_version() {
    if command_exists node; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            return 0
        fi
    fi
    return 1
}

print_header "TensorFlow.js 物体识别与人脸识别应用 v1.1.0"

# 1. 检查系统环境
print_info "正在检查系统环境..."

# 检查 Node.js
if ! check_node_version; then
    print_error "Node.js 版本需要 >= 18.0.0"
    print_info "请访问 https://nodejs.org/ 安装最新版本"
    exit 1
fi
print_success "Node.js $(node -v)"

# 检查 pnpm
if ! command_exists pnpm; then
    print_warning "pnpm 未安装,正在安装..."
    npm install -g pnpm
fi
print_success "pnpm $(pnpm -v)"

# 检查 MySQL
if ! command_exists mysql; then
    print_error "MySQL 未安装"
    print_info "请先安装 MySQL 8.0 或更高版本"
    print_info "  Ubuntu/Debian: sudo apt-get install mysql-server"
    print_info "  macOS: brew install mysql"
    exit 1
fi
print_success "MySQL 已安装"

# 2. 配置环境变量
print_info "正在配置环境变量..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        print_warning "已创建 .env 文件"
        echo ""
        print_info "是否现在配置数据库? (y/n)"
        read -r CONFIG_DB
        
        if [[ "$CONFIG_DB" =~ ^[Yy]$ ]]; then
            echo ""
            read -p "数据库用户名 [root]: " DB_USER
            DB_USER=${DB_USER:-root}
            
            read -sp "数据库密码: " DB_PASS
            echo ""
            
            read -p "数据库名称 [tfjs_detection]: " DB_NAME
            DB_NAME=${DB_NAME:-tfjs_detection}
            
            read -p "数据库主机 [localhost]: " DB_HOST
            DB_HOST=${DB_HOST:-localhost}
            
            read -p "数据库端口 [3306]: " DB_PORT
            DB_PORT=${DB_PORT:-3306}
            
            # 更新 .env 文件
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}|g" .env
            else
                sed -i "s|DATABASE_URL=.*|DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}|g" .env
            fi
            
            # 生成随机 JWT 密钥
            JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" .env
            else
                sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" .env
            fi
            
            print_success "数据库配置已更新"
            
            # 尝试创建数据库
            print_info "正在创建数据库..."
            if mysql -u"${DB_USER}" -p"${DB_PASS}" -h"${DB_HOST}" -P"${DB_PORT}" -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};" 2>/dev/null; then
                print_success "数据库创建成功"
            else
                print_warning "无法自动创建数据库,请手动执行: CREATE DATABASE ${DB_NAME};"
            fi
        else
            print_warning "请手动编辑 .env 文件配置数据库连接"
        fi
    else
        print_error ".env.example 文件不存在"
        exit 1
    fi
else
    print_success ".env 文件已存在"
fi

# 3. 安装依赖
echo ""
print_info "正在安装项目依赖 (这可能需要几分钟)..."
pnpm install
print_success "依赖安装完成"

# 4. 初始化数据库
echo ""
print_info "正在初始化数据库..."
if pnpm db:push; then
    print_success "数据库初始化完成"
else
    print_error "数据库初始化失败,请检查配置"
    exit 1
fi

# 5. 选择部署模式
echo ""
print_header "选择部署模式"
echo "  1) 开发模式 (dev) - 支持热重载,适合开发调试"
echo "  2) 生产模式 (production) - 性能优化,适合正式部署"
echo "  3) 生产模式 + 性能优化 - 应用所有优化配置"
echo ""
read -p "请选择 [1/2/3, 默认: 1]: " DEPLOY_MODE
DEPLOY_MODE=${DEPLOY_MODE:-1}

if [ "$DEPLOY_MODE" = "2" ] || [ "$DEPLOY_MODE" = "3" ]; then
    # 生产模式
    
    # 应用优化配置
    if [ "$DEPLOY_MODE" = "3" ]; then
        print_info "正在应用性能优化配置..."
        
        if [ -f vite.config.optimized.ts ]; then
            cp vite.config.ts vite.config.backup.ts 2>/dev/null || true
            cp vite.config.optimized.ts vite.config.ts
            print_success "Vite 配置已优化"
        fi
        
        if [ -f client/src/lib/faceRecognition.optimized.ts ]; then
            cp client/src/lib/faceRecognition.ts client/src/lib/faceRecognition.backup.ts 2>/dev/null || true
            cp client/src/lib/faceRecognition.optimized.ts client/src/lib/faceRecognition.ts
            print_success "人脸识别算法已优化"
        fi
    fi
    
    print_info "正在构建生产版本..."
    pnpm build
    print_success "构建完成"
    
    # 检查是否安装 PM2
    if ! command_exists pm2; then
        print_info "正在安装 PM2 进程管理器..."
        pnpm add -g pm2
        print_success "PM2 安装完成"
    fi
    
    # 启动应用
    print_info "正在启动应用..."
    pm2 delete tfjs-detection 2>/dev/null || true
    
    if [ -f ecosystem.config.cjs ]; then
        pm2 start ecosystem.config.cjs
    else
        pm2 start dist/index.js --name tfjs-detection
    fi
    
    pm2 save
    print_success "应用已启动"
    
    # 配置开机自启
    echo ""
    read -p "是否配置开机自启动? (y/n) " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        STARTUP_CMD=$(pm2 startup | grep "sudo" || true)
        if [ -n "$STARTUP_CMD" ]; then
            eval "$STARTUP_CMD"
            print_success "开机自启动已配置"
        fi
    fi
    
    echo ""
    print_header "🎉 部署完成!"
    echo ""
    print_success "应用运行在: http://localhost:3000"
    echo ""
    print_info "管理命令:"
    echo "  pm2 status                  # 查看状态"
    echo "  pm2 logs tfjs-detection     # 查看日志"
    echo "  pm2 restart tfjs-detection  # 重启应用"
    echo "  pm2 stop tfjs-detection     # 停止应用"
    echo "  pm2 monit                   # 实时监控"
    echo ""
    
    if [ "$DEPLOY_MODE" = "3" ]; then
        print_info "性能优化已启用:"
        echo "  ✓ 代码分割和压缩"
        echo "  ✓ 人脸识别算法优化"
        echo "  ✓ 预期性能提升 40-60%"
        echo ""
    fi
    
    print_info "查看完整文档:"
    echo "  cat DEPLOYMENT_SUMMARY.md"
    echo "  cat OPTIMIZATION_GUIDE.md"
    echo ""
    
else
    # 开发模式
    print_header "🎉 环境配置完成!"
    echo ""
    print_success "准备启动开发服务器..."
    print_info "应用将运行在: http://localhost:3000"
    echo ""
    print_warning "按 Ctrl+C 停止服务器"
    echo ""
    sleep 2
    pnpm dev
fi

