# TensorFlow.js 物体识别应用 - Windows 一键部署脚本

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "TensorFlow.js 物体识别应用" -ForegroundColor Cyan
Write-Host "一键部署脚本 (Windows)" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

function Print-Success {
    param($Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Print-Error {
    param($Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Print-Warning {
    param($Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Command-Exists {
    param($Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# 检查 Node.js
Write-Host "检查 Node.js..."
if (-not (Command-Exists node)) {
    Print-Error "未安装 Node.js"
    Write-Host "请访问 https://nodejs.org/ 下载安装 Node.js >= 18.0.0"
    exit 1
}

$nodeVersion = (node -v).Substring(1).Split('.')[0]
if ([int]$nodeVersion -lt 18) {
    Print-Error "Node.js 版本过低 (当前: $(node -v))"
    Write-Host "请升级到 Node.js >= 18.0.0"
    exit 1
}
Print-Success "Node.js $(node -v) 已安装"

# 检查 pnpm
Write-Host "检查 pnpm..."
if (-not (Command-Exists pnpm)) {
    Print-Warning "未安装 pnpm，正在安装..."
    npm install -g pnpm
    Print-Success "pnpm 安装完成"
} else {
    Print-Success "pnpm $(pnpm -v) 已安装"
}

# 安装依赖
Write-Host ""
Write-Host "正在安装项目依赖..."
pnpm install
if ($LASTEXITCODE -ne 0) {
    Print-Error "依赖安装失败"
    exit 1
}
Print-Success "依赖安装完成"

# 检查环境变量文件
Write-Host ""
Write-Host "检查环境变量配置..."
if (-not (Test-Path ".env")) {
    Print-Warning ".env 文件不存在，正在创建..."
    
    # 生成随机 JWT 密钥
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    $JWT_SECRET = [Convert]::ToBase64String($bytes)
    
    $envContent = @"
# 数据库配置
# 请修改为您的数据库连接信息
DATABASE_URL=mysql://root:password@localhost:3306/tfjs_detection

# JWT 密钥（已自动生成）
JWT_SECRET=$JWT_SECRET

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
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Print-Success ".env 文件已创建"
    Print-Warning "请编辑 .env 文件，配置数据库连接信息"
    Write-Host ""
    Write-Host "按 Enter 继续，或按 Ctrl+C 退出并编辑配置..."
    Read-Host
}

# 检查数据库配置
Write-Host ""
Write-Host "检查数据库配置..."
$envContent = Get-Content ".env" -Raw
if ($envContent -match "mysql://root:password@localhost") {
    Print-Warning "检测到默认数据库配置，请确保已修改为正确的数据库连接信息"
    Write-Host "当前配置："
    Get-Content ".env" | Select-String "DATABASE_URL"
    Write-Host ""
    $response = Read-Host "是否继续？(y/n)"
    if ($response -notmatch "^[Yy]$") {
        Print-Error "部署已取消，请编辑 .env 文件后重新运行"
        exit 1
    }
}

# 初始化数据库
Write-Host ""
Write-Host "正在初始化数据库..."
pnpm db:push
if ($LASTEXITCODE -ne 0) {
    Print-Error "数据库初始化失败"
    Print-Warning "请检查数据库连接配置是否正确"
    exit 1
}
Print-Success "数据库初始化完成"

# 构建项目
Write-Host ""
Write-Host "正在构建项目..."
pnpm build
if ($LASTEXITCODE -ne 0) {
    Print-Error "项目构建失败"
    exit 1
}
Print-Success "项目构建完成"

# 完成
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Print-Success "部署完成！"
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "启动应用："
Write-Host "  开发模式: pnpm dev"
Write-Host "  生产模式: pnpm start"
Write-Host ""
Write-Host "访问地址："
Write-Host "  http://localhost:3000"
Write-Host ""
Write-Host "管理功能："
Write-Host "  1. 首次访问需要登录"
Write-Host "  2. 管理员可在'人员管理'页面添加人员"
Write-Host "  3. 在'物体识别'页面开始检测"
Write-Host ""
$response = Read-Host "是否现在启动应用？(y/n)"
if ($response -match "^[Yy]$") {
    Write-Host ""
    Write-Host "正在启动应用..."
    pnpm start
}

