import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import History from "./pages/History";
import BackendAdmin from "./pages/BackendAdmin";
import Login from "./pages/Login";
import { useAuth } from "./_core/hooks/useAuth";
import { Button } from "./components/ui/button";
import { APP_TITLE } from "./const";
import { useEffect } from "react";

function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  // 服务器本地自动登录
  useEffect(() => {
    if (!isAuthenticated) {
      // 自动登录为管理员 LBX - 使用 OAuth 流程
      console.log("服务器本地自动登录模式");
    }
  }, [isAuthenticated]);

  return (
    <nav className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/">
              <span className="text-xl font-bold text-white hover:text-gray-300 transition cursor-pointer">
                {APP_TITLE}
              </span>
            </Link>
            <div className="flex gap-4">
              <Link href="/">
                <span
                  className={`px-3 py-2 rounded-md text-sm font-medium transition cursor-pointer inline-block ${
                    location === "/"
                      ? "bg-gray-700 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  物体识别
                </span>
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/history">
                    <span
                      className={`px-3 py-2 rounded-md text-sm font-medium transition cursor-pointer inline-block ${
                        location === "/history"
                          ? "bg-gray-700 text-white"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      识别记录
                    </span>
                  </Link>
                  {user?.role === "admin" && (
                    <>
                      <Link href="/admin">
                        <span
                          className={`px-3 py-2 rounded-md text-sm font-medium transition cursor-pointer inline-block ${
                            location === "/admin"
                              ? "bg-gray-700 text-white"
                              : "text-gray-300 hover:bg-gray-700 hover:text-white"
                          }`}
                        >
                          人员管理
                        </span>
                      </Link>
                      <Link href="/backend">
                        <span
                          className={`px-3 py-2 rounded-md text-sm font-medium transition cursor-pointer inline-block ${
                            location === "/backend"
                              ? "bg-gray-700 text-white"
                              : "text-gray-300 hover:bg-gray-700 hover:text-white"
                          }`}
                        >
                          后台管理
                        </span>
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-gray-300 text-sm">
                  {user?.name || "LBX"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  退出
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  登录
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={Login} />
        <Route path={"/admin"} component={Admin} />
        <Route path={"/history"} component={History} />
        <Route path={"/backend"} component={BackendAdmin} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

