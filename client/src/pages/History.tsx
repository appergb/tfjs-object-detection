import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function History() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: logs, isLoading } = trpc.detectionLogs.myLogs.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Card className="bg-gray-800/50 border-gray-700 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">需要登录</h2>
          <p className="text-gray-400 mb-6">请先登录以查看识别记录</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>
            登录
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">识别记录</h1>
          <p className="text-gray-400">查看您的物体识别历史记录</p>
        </div>

        {isLoading ? (
          <div className="text-center text-white">加载中...</div>
        ) : (
          <div className="space-y-4">
            {logs?.map((log) => {
              const detectedObjects = log.detectedObjects
                ? JSON.parse(log.detectedObjects)
                : [];

              return (
                <Card
                  key={log.id}
                  className="bg-gray-800/50 border-gray-700 p-6"
                >
                  <div className="flex gap-6">
                    {log.snapshotUrl && (
                      <img
                        src={log.snapshotUrl}
                        alt="快照"
                        className="w-32 h-32 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          {log.personName && log.personName !== "未知" ? (
                            <div>
                              <h3 className="text-xl font-semibold text-white">
                                识别到: {log.personName}
                              </h3>
                              <p className="text-green-400">
                                置信度: {log.confidence}%
                              </p>
                            </div>
                          ) : (
                            <h3 className="text-xl font-semibold text-gray-400">
                              识别到: 未知
                            </h3>
                          )}
                        </div>
                        <span className="text-gray-500 text-sm">
                          {formatDistanceToNow(new Date(log.createdAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </span>
                      </div>

                      {detectedObjects.length > 0 && (
                        <div>
                          <h4 className="text-white font-medium mb-2">
                            检测到的物体:
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {detectedObjects.map((obj: any, idx: number) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm"
                              >
                                {obj.class === "person" ? "人" : obj.class} (
                                {obj.score}%)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {logs?.length === 0 && (
          <Card className="bg-gray-800/50 border-gray-700 p-12 text-center">
            <p className="text-gray-400 text-lg">还没有任何识别记录</p>
          </Card>
        )}
      </div>
    </div>
  );
}

