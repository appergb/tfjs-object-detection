import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import type { DetectedObject } from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_TITLE } from "@/const";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [predictions, setPredictions] = useState<DetectedObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const animationFrameRef = useRef<number | undefined>(undefined);

  // 加载模型
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        setError("模型加载失败，请刷新页面重试");
        setIsLoading(false);
      }
    };
    loadModel();
  }, []);

  // 启动摄像头
  const startCamera = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("无法访问摄像头，请确保已授予权限");
    }
  };

  // 停止摄像头
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsDetecting(false);
    setPredictions([]);
    // 清空画布
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // 开始检测
  const startDetection = async () => {
    if (!model || !videoRef.current) return;

    await startCamera();
    setIsDetecting(true);

    const detect = async () => {
      if (
        videoRef.current &&
        videoRef.current.readyState === 4 &&
        canvasRef.current &&
        model
      ) {
        // 设置画布尺寸
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 进行检测
        const predictions = await model.detect(video);
        setPredictions(predictions);

        // 绘制检测框
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = "18px Arial";
          ctx.lineWidth = 3;

          predictions.forEach((prediction) => {
            const [x, y, width, height] = prediction.bbox;
            
            // 绘制边框
            ctx.strokeStyle = "#00ff00";
            ctx.strokeRect(x, y, width, height);

            // 绘制标签背景
            const text = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = "#00ff00";
            ctx.fillRect(x, y - 25, textWidth + 10, 25);

            // 绘制标签文字
            ctx.fillStyle = "#000000";
            ctx.fillText(text, x + 5, y - 7);
          });
        }
      }

      if (isDetecting) {
        animationFrameRef.current = requestAnimationFrame(detect);
      }
    };

    detect();
  };

  // 停止检测
  const handleStopDetection = () => {
    stopCamera();
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            {APP_TITLE}
          </h1>
          <p className="text-gray-400 text-lg">
            使用 TensorFlow.js 和 COCO-SSD 模型进行实时物体识别
          </p>
        </div>

        {/* 主要内容 */}
        <div className="max-w-5xl mx-auto">
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            {/* 错误提示 */}
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
                {error}
              </div>
            )}

            {/* 加载提示 */}
            {isLoading && (
              <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg text-blue-400">
                正在加载模型，请稍候...
              </div>
            )}

            {/* 视频和画布容器 */}
            <div className="relative mb-6 bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
                style={{ display: isDetecting ? "block" : "none" }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ display: isDetecting ? "block" : "none" }}
              />
              {!isDetecting && (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  <div className="text-center">
                    <svg
                      className="mx-auto h-24 w-24 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-lg">点击下方按钮开始检测</p>
                  </div>
                </div>
              )}
            </div>

            {/* 控制按钮 */}
            <div className="flex gap-4 justify-center mb-6">
              {!isDetecting ? (
                <Button
                  onClick={startDetection}
                  disabled={!model || isLoading}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  开始检测
                </Button>
              ) : (
                <Button
                  onClick={handleStopDetection}
                  size="lg"
                  variant="destructive"
                >
                  停止检测
                </Button>
              )}
            </div>

            {/* 检测结果列表 */}
            {predictions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  检测到的物体 ({predictions.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {predictions.map((prediction, index) => (
                    <div
                      key={index}
                      className="bg-gray-700/50 border border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">
                          {prediction.class}
                        </span>
                        <span className="text-green-400 font-semibold">
                          {Math.round(prediction.score * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 说明信息 */}
            <div className="mt-8 p-4 bg-gray-700/30 border border-gray-600 rounded-lg">
              <h4 className="text-white font-semibold mb-2">使用说明</h4>
              <ul className="text-gray-400 space-y-1 text-sm">
                <li>• 点击"开始检测"按钮启动摄像头并开始实时物体识别</li>
                <li>• 系统会自动识别画面中的物体并用绿色框标注</li>
                <li>• 支持识别 80 种常见物体类别（人、车、动物、家具等）</li>
                <li>• 所有处理都在浏览器本地完成，不会上传任何数据</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

