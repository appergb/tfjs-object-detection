import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import type { DetectedObject } from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  initFaceDetector,
  detectFaces,
  extractFaceEmbedding,
  matchFace,
} from "@/lib/faceRecognition";
import { toast } from "sonner";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [predictions, setPredictions] = useState<DetectedObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [recognizedPerson, setRecognizedPerson] = useState<{
    name: string;
    confidence: number;
  } | null>(null);
  const detectingRef = useRef(false);
  const { isAuthenticated } = useAuth();

  // 获取人员列表用于人脸比对
  const { data: persons } = trpc.persons.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // 加载模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        // 加载物体检测模型
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        
        // 预加载人脸检测模型
        if (isAuthenticated) {
          await initFaceDetector();
        }
        
        setIsLoading(false);
      } catch (err) {
        setErrorMsg("模型加载失败，请刷新页面重试");
        setIsLoading(false);
      }
    };
    loadModels();
  }, [isAuthenticated]);

  // 启动摄像头
  const startCamera = async () => {
    try {
      setErrorMsg("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          }
        });
      }
      return true;
    } catch (err) {
      setErrorMsg("无法访问摄像头，请确保已授予权限");
      return false;
    }
  };

  // 停止摄像头
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    detectingRef.current = false;
    setIsDetecting(false);
    setPredictions([]);
    setRecognizedPerson(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // 检测循环
  const detectLoop = async () => {
    if (!detectingRef.current || !model || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        // 进行物体检测
        const detections = await model.detect(video);
        setPredictions(detections);

        // 如果已登录且有人员数据，进行人脸识别
        if (isAuthenticated && persons && persons.length > 0) {
          try {
            const faces = await detectFaces(video);
            
            if (faces.length > 0) {
              // 提取第一个人脸的特征
              const faceEmbedding = extractFaceEmbedding(faces[0]);
              
              // 准备已知人脸数据
              const knownFaces = persons
                .filter((p) => p.faceEmbedding)
                .map((p) => ({
                  id: p.id,
                  name: p.name,
                  embedding: JSON.parse(p.faceEmbedding!),
                }));

              if (knownFaces.length > 0) {
                // 进行人脸匹配
                const match = matchFace(faceEmbedding, knownFaces, 0.5);
                
                if (match) {
                  setRecognizedPerson({
                    name: match.name,
                    confidence: match.similarity,
                  });
                } else {
                  setRecognizedPerson(null);
                }
              }
            } else {
              setRecognizedPerson(null);
            }
          } catch (faceErr) {
            console.error("Face detection error:", faceErr);
          }
        }

        // 绘制检测框
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = "18px Arial";
          ctx.lineWidth = 3;

          detections.forEach((detection) => {
            const [x, y, width, height] = detection.bbox;
            
            ctx.strokeStyle = "#00ff00";
            ctx.strokeRect(x, y, width, height);

            const text = `${detection.class === "person" ? "人" : detection.class} ${Math.round(detection.score * 100)}%`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = "#00ff00";
            ctx.fillRect(x, y > 25 ? y - 25 : y, textWidth + 10, 25);

            ctx.fillStyle = "#000000";
            ctx.fillText(text, x + 5, y > 25 ? y - 7 : y + 18);
          });
        }
      } catch (err) {
        console.error("检测错误:", err);
      }
    }

    if (detectingRef.current) {
      requestAnimationFrame(detectLoop);
    }
  };

  // 开始检测
  const startDetection = async () => {
    if (!model) {
      setErrorMsg("模型尚未加载完成");
      return;
    }

    const cameraStarted = await startCamera();
    if (!cameraStarted) {
      return;
    }

    detectingRef.current = true;
    setIsDetecting(true);
    
    requestAnimationFrame(detectLoop);
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
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            实时物体与人脸识别
          </h1>
          <p className="text-gray-400 text-lg">
            使用 TensorFlow.js 进行实时物体检测和人脸识别
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            {errorMsg && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
                {errorMsg}
              </div>
            )}

            {isLoading && (
              <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg text-blue-400">
                正在加载模型，请稍候...
              </div>
            )}

            {model && !isLoading && !isDetecting && (
              <div className="mb-4 p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400">
                模型加载成功！点击下方按钮开始检测
                {isAuthenticated && persons && persons.length > 0 && (
                  <div className="mt-2 text-sm">
                    已加载 {persons.length} 个人员信息，可进行人脸识别
                  </div>
                )}
              </div>
            )}

            {/* 识别到的人员提示 */}
            {recognizedPerson && (
              <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-purple-400 font-semibold text-lg">
                      识别到: {recognizedPerson.name}
                    </span>
                  </div>
                  <div className="text-purple-300 text-sm">
                    置信度: {recognizedPerson.confidence}%
                  </div>
                </div>
              </div>
            )}

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
                        <span className="text-white font-medium capitalize">
                          {prediction.class === "person" ? "人" : prediction.class}
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

            <div className="mt-8 p-4 bg-gray-700/30 border border-gray-600 rounded-lg">
              <h4 className="text-white font-semibold mb-2">功能说明</h4>
              <ul className="text-gray-400 space-y-1 text-sm">
                <li>• 实时检测画面中的物体（支持 80 种常见物体类别）</li>
                <li>• 自动识别人脸并用绿色框标注</li>
                {isAuthenticated ? (
                  <>
                    <li>• 已登录用户可使用人脸识别功能</li>
                    <li>• 管理员可在"人员管理"页面添加人员信息</li>
                    <li>• 系统会自动比对并识别已录入的人员</li>
                  </>
                ) : (
                  <li>• 登录后可使用人脸识别和记录保存功能</li>
                )}
                <li>• 所有处理都在浏览器本地完成，保护隐私</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

