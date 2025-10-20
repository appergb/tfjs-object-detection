import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import History from "./pages/History";
import { useAuth } from "./_core/hooks/useAuth";
import { Button } from "./components/ui/button";
import { APP_TITLE, getLoginUrl } from "./const";

function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="text-xl font-bold text-white hover:text-gray-300 transition">
                {APP_TITLE}
              </a>
            </Link>
            <div className="flex gap-4">
              <Link href="/">
                <a
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    location === "/"
                      ? "bg-gray-700 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  物体识别
                </a>
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/history">
                    <a
                      className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                        location === "/history"
                          ? "bg-gray-700 text-white"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      识别记录
                    </a>
                  </Link>
                  {user?.role === "admin" && (
                    <Link href="/admin">
                      <a
                        className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                          location === "/admin"
                            ? "bg-gray-700 text-white"
                            : "text-gray-300 hover:bg-gray-700 hover:text-white"
                        }`}
                      >
                        人员管理
                      </a>
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
          <div>
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-300 text-sm">{user?.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout()}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  退出
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = getLoginUrl())}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                登录
              </Button>
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
        <Route path={"/admin"} component={Admin} />
        <Route path={"/history"} component={History} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
