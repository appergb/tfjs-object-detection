import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface QuickLoginProps {
  onClose?: () => void;
}

// 默认账号配置
const DEFAULT_ACCOUNTS = {
  admin: {
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "管理员",
  },
  user: {
    username: "user",
    password: "user123",
    role: "user",
    name: "普通用户",
  },
};

export default function QuickLogin({ onClose }: QuickLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleQuickLogin = (accountType: "admin" | "user") => {
    const account = DEFAULT_ACCOUNTS[accountType];
    setUsername(account.username);
    setPassword(account.password);
    toast.info(`已填入${account.name}账号`);
  };

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error("请输入用户名和密码");
      return;
    }

    setIsLoading(true);

    try {
      // 验证账号
      const account = Object.values(DEFAULT_ACCOUNTS).find(
        (acc) => acc.username === username && acc.password === password
      );

      if (!account) {
        toast.error("用户名或密码错误");
        setIsLoading(false);
        return;
      }

      // 保存登录信息到 localStorage
      localStorage.setItem(
        "quickLoginUser",
        JSON.stringify({
          username: account.username,
          name: account.name,
          role: account.role,
          loginTime: Date.now(),
        })
      );

      toast.success(`欢迎，${account.name}！`);
      
      // 刷新页面以应用登录状态
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast.error("登录失败");
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-gray-800/90 border-gray-700 p-6 max-w-md w-full">
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">快速登录</h2>
          <p className="text-gray-400 text-sm">
            使用默认账号快速体验系统功能
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="username" className="text-gray-300">
              用户名
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="bg-gray-700 border-gray-600 text-white"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-gray-300">
              密码
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="bg-gray-700 border-gray-600 text-white"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "登录中..." : "登录"}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-gray-400 text-sm text-center">快速填入默认账号</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleQuickLogin("admin")}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              管理员账号
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickLogin("user")}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              普通用户
            </Button>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
          <p className="text-gray-300 text-sm font-semibold">默认账号信息：</p>
          <div className="text-gray-400 text-xs space-y-1">
            <p>
              <span className="text-blue-400">管理员：</span>
              用户名: admin / 密码: admin123
            </p>
            <p>
              <span className="text-green-400">普通用户：</span>
              用户名: user / 密码: user123
            </p>
          </div>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-gray-400 hover:text-white"
          >
            取消
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * 获取快速登录用户信息
 */
export function getQuickLoginUser() {
  try {
    const userStr = localStorage.getItem("quickLoginUser");
    if (!userStr) return null;

    const user = JSON.parse(userStr);
    
    // 检查登录是否过期（24小时）
    const loginTime = user.loginTime || 0;
    const now = Date.now();
    const expired = now - loginTime > 24 * 60 * 60 * 1000;

    if (expired) {
      localStorage.removeItem("quickLoginUser");
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * 退出快速登录
 */
export function quickLogout() {
  localStorage.removeItem("quickLoginUser");
  toast.success("已退出登录");
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

