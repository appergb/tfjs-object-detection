import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import { toast } from "sonner";
import { detectFaces, matchFace, extractFaceEmbedding } from "@/lib/faceRecognition";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detections, setDetections] = useState<Array<{
    class: string;
    score: number;
    bbox: number[];
  }>>([]);
  const [faceDetections, setFaceDetections] = useState<Array<{
    name: string;
    confidence: number;
    bbox: number[];
  }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectingRef = useRef(false);

  const { data: persons } = trpc.persons.list.useQuery();
  const { data: stats } = trpc.stats.getOverview.useQuery();

  useEffect(() => {
    // 加载模型
    const loadModel = async () => {
      try {
        toast.info("正在加载模型，请稍候...");
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        toast.success("模型加载完成！");
      } catch (error) {
        toast.error("模型加载失败");
        console.error(error);
      }
    };

    loadModel();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        toast.success("摄像头已启动");
      }
    } catch (error) {
      toast.error("无法访问摄像头，请确保已授予权限");
      console.error(error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      toast.info("摄像头已停止");
    }
  };

  const startDetection = async () => {
    if (!model) {
      toast.error("模型尚未加载");
      return;
    }

    if (!videoRef.current || !videoRef.current.srcObject) {
      await startCamera();
      // 等待视频准备好
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setIsDetecting(true);
    detectingRef.current = true;
    toast.success("开始检测");

    detectLoop();
  };

  const stopDetection = () => {
    setIsDetecting(false);
    detectingRef.current = false;
    toast.info("停止检测");
  };

  const detectLoop = async () => {
    if (!detectingRef.current || !model || !videoRef.current) {
      return;
    }

    try {
      // 每隔几帧才进行一次检测，提高性能
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 物体检测
      const predictions = await model.detect(videoRef.current);
      setDetections(predictions);

      // 人脸识别
      const detectedFaces: Array<{
        name: string;
        confidence: number;
        bbox: number[];
      }> = [];

      if (persons && persons.length > 0) {
        try {
          const faces = await detectFaces(videoRef.current);
          
          for (const face of faces) {
            const embedding = await extractFaceEmbedding(face);
            
            if (embedding) {
              const knownFaces = persons
                .filter((p) => p.faceEmbedding)
                .map((p) => ({
                  id: p.id,
                  name: p.name,
                  embedding: JSON.parse(p.faceEmbedding!),
                }));

              const match = matchFace(embedding, knownFaces);
              
              if (match) {
                // 计算人脸边界框
                const keypoints = face.keypoints;
                const xs = keypoints.map(p => p.x);
                const ys = keypoints.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                
                detectedFaces.push({
                  name: match.name,
                  confidence: match.similarity,
                  bbox: [minX, minY, maxX - minX, maxY - minY],
                });
              }
            }
          }
        } catch (error) {
          // 人脸识别失败不影响物体检测
          console.error("Face recognition error:", error);
        }
      }

      setFaceDetections(detectedFaces);

      // 绘制检测框
      drawDetections(predictions, detectedFaces);

      // 继续检测
      requestAnimationFrame(detectLoop);
    } catch (error) {
      console.error("Detection error:", error);
      detectingRef.current = false;
      setIsDetecting(false);
    }
  };

  const drawDetections = (
    predictions: Array<{
      class: string;
      score: number;
      bbox: number[];
    }>,
    faces: Array<{
      name: string;
      confidence: number;
      bbox: number[];
    }>
  ) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制物体检测框（绿色）
    predictions.forEach((prediction) => {
      const [x, y, width, height] = prediction.bbox;

      // 绘制边界框
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      // 绘制标签背景
      ctx.fillStyle = "#00ff00";
      const label = `${prediction.class === "person" ? "人" : prediction.class} ${(
        prediction.score * 100
      ).toFixed(0)}%`;
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x, y - 25, textWidth + 10, 25);

      // 绘制标签文字
      ctx.fillStyle = "#000000";
      ctx.font = "16px Arial";
      ctx.fillText(label, x + 5, y - 7);
    });

    // 绘制人脸检测框（黄色）
    faces.forEach((face) => {
      const [x, y, width, height] = face.bbox;

      // 绘制边界框
      ctx.strokeStyle = "#ffff00";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // 绘制标签背景
      ctx.fillStyle = "#ffff00";
      const label = `${face.name} ${face.confidence.toFixed(0)}%`;
      ctx.font = "bold 18px Arial";
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x, y - 30, textWidth + 10, 30);

      // 绘制标签文字
      ctx.fillStyle = "#000000";
      ctx.fillText(label, x + 5, y - 8);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* 顶部栏 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-1">
            实时物体与人脸识别系统
          </h1>
          <p className="text-gray-400 text-sm">
            使用 TensorFlow.js 进行实时物体检测和人脸识别
          </p>
        </div>

        {/* 主要内容区 - 左右布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：识别结果和统计 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 统计卡片 */}
            {stats && (
              <Card className="bg-gray-800/50 border-gray-700 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  系统统计
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">总人数</span>
                    <span className="text-2xl font-bold text-blue-400">
                      {stats.totalPersons}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">总识别次数</span>
                    <span className="text-2xl font-bold text-green-400">
                      {stats.totalLogs}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">今日识别</span>
                    <span className="text-2xl font-bold text-yellow-400">
                      {stats.todayLogs}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* 人脸识别结果 */}
            {faceDetections.length > 0 && (
              <Card className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 p-6">
                <h3 className="text-xl font-semibold text-white mb-3">
                  人脸识别结果
                </h3>
                <div className="space-y-3">
                  {faceDetections.map((face, index) => (
                    <div key={index} className="bg-gray-700/50 rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-white">
                          {face.name}
                        </span>
                        <span className="text-lg font-semibold text-yellow-400">
                          {face.confidence.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 检测到的物体列表 */}
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                检测到的物体
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {detections.length > 0 ? (
                  detections.map((detection, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-gray-700/50 rounded px-3 py-2"
                    >
                      <span className="text-gray-300">
                        {detection.class === "person" ? "人" : detection.class}
                      </span>
                      <span className="text-green-400 font-semibold">
                        {(detection.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    暂无检测结果
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* 右侧：摄像头和控制 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 视频显示区 */}
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-auto"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full"
                />
                {!isDetecting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center">
                      <svg
                        className="w-24 h-24 mx-auto mb-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-gray-400 text-lg">
                        点击下方按钮开始检测
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 控制按钮 */}
              <div className="flex gap-3 mt-4">
                {!isDetecting ? (
                  <Button
                    onClick={startDetection}
                    disabled={!model}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-6"
                  >
                    {model ? "开始检测" : "模型加载中..."}
                  </Button>
                ) : (
                  <Button
                    onClick={stopDetection}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-lg py-6"
                  >
                    停止检测
                  </Button>
                )}
              </div>
            </Card>

            {/* 功能说明 */}
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                功能说明
              </h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• 实时检测画面中的物体（绿色框，支持 80 种物体类别）</li>
                <li>• 自动识别已录入的人脸并显示姓名（黄色框）</li>
                <li>• 管理员可访问 /backend 页面添加人员信息</li>
                <li>• 所有处理都在浏览器本地完成，保护隐私</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

