import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_TITLE } from "@/const";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error("请输入用户名和密码");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("登录成功");
        // 刷新页面以更新认证状态
        window.location.href = "/";
      } else {
        toast.error(data.error || "登录失败");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 md:p-8 bg-gray-800/50 backdrop-blur-sm border-gray-700">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{APP_TITLE}</h1>
          <p className="text-sm md:text-base text-gray-400">登录以继续使用</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-gray-300">
              用户名
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300">
              密码
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading}
          >
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>

        <div className="mt-4 md:mt-6 text-center text-xs md:text-sm text-gray-400">
          <p>默认账户: LBX / 198305</p>
        </div>
      </Card>
    </div>
  );
}

