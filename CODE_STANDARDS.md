# 代码规范和最佳实践

## 项目结构

### 前端结构
```
client/src/
├── pages/           # 页面组件
├── components/      # 可复用组件
│   └── ui/         # UI组件库
├── lib/            # 工具函数和核心逻辑
├── hooks/          # 自定义React Hooks
├── contexts/       # React Context
└── _core/          # 核心功能模块
```

### 后端结构
```
server/
├── _core/          # 核心功能模块
│   ├── index.ts    # 服务器入口
│   ├── trpc.ts     # tRPC配置
│   ├── context.ts  # 请求上下文
│   └── localAuth.ts # 本地认证
├── routers.ts      # API路由定义
└── db.ts           # 数据库连接
```

## 命名规范

### 文件命名
- React组件: PascalCase (例如: `Home.tsx`, `Login.tsx`)
- 工具函数: camelCase (例如: `faceRecognition.ts`, `utils.ts`)
- 常量文件: camelCase (例如: `const.ts`)
- 类型定义: camelCase (例如: `types.ts`)

### 变量命名
- 组件: PascalCase (例如: `UserProfile`)
- 函数: camelCase (例如: `detectFaces`, `handleSubmit`)
- 常量: UPPER_SNAKE_CASE (例如: `APP_TITLE`, `MAX_RETRIES`)
- 接口/类型: PascalCase (例如: `User`, `FaceDetection`)

### CSS类名
- 使用Tailwind CSS工具类
- 自定义类名使用kebab-case (例如: `face-detection-box`)

## TypeScript规范

### 类型定义
```typescript
// ✅ 推荐: 明确的类型定义
interface FaceDetection {
  name: string;
  confidence: number;
  bbox: number[];
}

// ❌ 避免: 使用any
const data: any = {};

// ✅ 推荐: 使用具体类型或unknown
const data: FaceDetection = { name: "张三", confidence: 0.95, bbox: [0, 0, 100, 100] };
```

### 函数类型
```typescript
// ✅ 推荐: 明确的参数和返回值类型
async function detectFaces(video: HTMLVideoElement): Promise<Face[]> {
  // ...
}

// ✅ 推荐: 使用箭头函数和类型推断
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  // ...
};
```

## React规范

### 组件结构
```typescript
// ✅ 推荐的组件结构
export default function ComponentName() {
  // 1. Hooks
  const [state, setState] = useState();
  const { data } = useQuery();
  
  // 2. 派生状态和计算
  const derivedValue = useMemo(() => {}, []);
  
  // 3. 副作用
  useEffect(() => {}, []);
  
  // 4. 事件处理函数
  const handleEvent = () => {};
  
  // 5. 渲染
  return <div>...</div>;
}
```

### Hooks使用
```typescript
// ✅ 推荐: 自定义Hook提取复杂逻辑
function useFaceDetection() {
  const [faces, setFaces] = useState([]);
  // ... 复杂逻辑
  return { faces, detectFaces };
}

// ✅ 推荐: 使用依赖数组
useEffect(() => {
  detectFaces();
}, [videoRef.current]); // 明确依赖
```

## 错误处理

### Try-Catch使用
```typescript
// ✅ 推荐: 具体的错误处理
try {
  const result = await detectFaces(video);
  setFaces(result);
} catch (error) {
  console.error("Face detection error:", error);
  toast.error("人脸检测失败,请重试");
  // 不影响其他功能继续执行
}

// ❌ 避免: 吞掉错误
try {
  // ...
} catch (error) {
  // 什么都不做
}
```

### 用户反馈
```typescript
// ✅ 推荐: 给用户明确的反馈
toast.info("正在加载模型...");
toast.success("模型加载完成");
toast.error("加载失败,请刷新页面");
toast.warning("人脸质量较低");
```

## 性能优化

### 避免不必要的渲染
```typescript
// ✅ 推荐: 使用useMemo缓存计算结果
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// ✅ 推荐: 使用useCallback缓存函数
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

### 图片和资源优化
```typescript
// ✅ 推荐: 懒加载大型模型
const loadModel = async () => {
  const model = await import('@tensorflow-models/coco-ssd');
  return model.load();
};

// ✅ 推荐: 控制检测频率
const DETECTION_INTERVAL = 300; // ms
if (now - lastDetectionTime.current < DETECTION_INTERVAL) {
  return;
}
```

## 代码注释

### 函数注释
```typescript
/**
 * 检测视频流中的人脸
 * @param video - HTML视频元素
 * @returns 检测到的人脸数组
 * @throws 当视频元素无效或模型未加载时抛出错误
 */
async function detectFaces(video: HTMLVideoElement): Promise<Face[]> {
  // 实现...
}
```

### 复杂逻辑注释
```typescript
// 计算正方形边界框以确保人脸完整显示
const width = maxX - minX;
const height = maxY - minY;
const size = Math.max(width, height) * 1.5; // 放大1.5倍留出边距
```

## Git提交规范

### 提交信息格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type类型
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

### 示例
```
feat(auth): 实现本地认证系统

- 添加用户名/密码登录
- 使用bcryptjs加密密码
- 实现JWT会话管理

Closes #123
```

## 安全规范

### 密码处理
```typescript
// ✅ 推荐: 使用bcrypt加密
import bcrypt from 'bcryptjs';
const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, hashedPassword);

// ❌ 避免: 明文存储密码
const user = { password: "123456" }; // 绝对不要这样做
```

### 环境变量
```typescript
// ✅ 推荐: 使用环境变量存储敏感信息
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

// ❌ 避免: 硬编码敏感信息
const JWT_SECRET = "my-secret-key"; // 不要这样做
```

## 测试规范

### 单元测试
```typescript
// ✅ 推荐: 测试关键功能
describe('detectFaces', () => {
  it('should detect faces in video', async () => {
    const video = createMockVideo();
    const faces = await detectFaces(video);
    expect(faces).toHaveLength(1);
  });
  
  it('should handle errors gracefully', async () => {
    const invalidVideo = null;
    await expect(detectFaces(invalidVideo)).rejects.toThrow();
  });
});
```

## 文档规范

### README.md必须包含
1. 项目简介
2. 功能特性
3. 技术栈
4. 安装步骤
5. 使用说明
6. 配置说明
7. 常见问题

### API文档
- 每个API端点都应有清晰的文档
- 包含请求参数、响应格式、错误码
- 提供示例代码

## 代码审查清单

### 提交前检查
- [ ] 代码符合命名规范
- [ ] 添加了必要的注释
- [ ] 处理了所有错误情况
- [ ] 测试了主要功能
- [ ] 检查了性能影响
- [ ] 更新了相关文档
- [ ] Git提交信息清晰
- [ ] 没有console.log调试代码
- [ ] 没有硬编码的敏感信息
- [ ] TypeScript类型定义完整

## 最佳实践总结

1. **保持代码简洁** - 一个函数只做一件事
2. **避免重复** - 提取公共逻辑到工具函数
3. **明确类型** - 充分利用TypeScript的类型系统
4. **错误处理** - 永远不要忽略错误
5. **用户体验** - 提供清晰的加载和错误提示
6. **性能优先** - 避免不必要的计算和渲染
7. **安全第一** - 永远不要信任用户输入
8. **文档完善** - 代码是写给人看的
9. **测试覆盖** - 关键功能必须有测试
10. **持续改进** - 定期重构和优化代码

