import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import { toast } from "sonner";
import { detectFaces, extractFaceEmbedding, matchFace } from "@/lib/faceRecognition";
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
  const lastDetectionTime = useRef(0);
  const lastSaveTime = useRef(0);

  const { data: persons } = trpc.persons.list.useQuery();
  const { data: stats } = trpc.stats.getOverview.useQuery();
  const saveDetectionMutation = trpc.detectionLogs.create.useMutation();

  useEffect(() => {
    // 加载模型
    const loadModel = async () => {
      try {
        toast.info("正在加载物体检测模型...");
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
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
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
      await new Promise((resolve) => setTimeout(resolve, 1500));
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
      const now = Date.now();
      // 控制帧率，每300ms检测一次
      if (now - lastDetectionTime.current < 300) {
        requestAnimationFrame(detectLoop);
        return;
      }
      lastDetectionTime.current = now;

      // 物体检测
      const predictions = await model.detect(videoRef.current);
      setDetections(predictions);

      // 人脸识别 - 始终执行人脸检测,无论数据库是否有人员数据
      const detectedFaces: Array<{
        name: string;
        confidence: number;
        bbox: number[];
      }> = [];

      try {
        const faces = await detectFaces(videoRef.current);
        
        for (const face of faces) {
          const embedding = extractFaceEmbedding(face);
          
          if (embedding) {
            let match = null;
            
            // 只有当数据库有人员数据时才进行匹配
            if (persons && persons.length > 0) {
              const knownFaces = persons
                .filter((p) => p.faceEmbedding)
                .map((p) => ({
                  id: p.id,
                  name: p.name,
                  embedding: JSON.parse(p.faceEmbedding!),
                }));

              if (knownFaces.length > 0) {
                match = matchFace(embedding, knownFaces, 0.5);
              }
            }
            
            // 计算人脸边界框（正方形）
            const keypoints = face.keypoints;
            const xs = keypoints.map(p => p.x);
            const ys = keypoints.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            
            // 计算中心点
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            
            // 使用较大的边作为正方形边长
            const width = maxX - minX;
            const height = maxY - minY;
            const size = Math.max(width, height) * 1.5; // 放大1.5倍确保完整包含人脸
            
            // 计算正方形边界框
            const squareX = centerX - size / 2;
            const squareY = centerY - size / 2;
            
            // 无论是否匹配都添加到检测结果中
            detectedFaces.push({
              name: match ? match.name : "未知",
              confidence: match ? match.similarity * 100 : 0,
              bbox: [squareX, squareY, size, size],
            });
          }
        }
      } catch (error) {
        // 人脸识别失败不影响物体检测
        console.error("Face recognition error:", error);
      }

      setFaceDetections(detectedFaces);

      // 保存识别记录(每5秒保存一次,避免频繁保存)
      if (now - lastSaveTime.current > 5000 && (detectedFaces.length > 0 || predictions.length > 0)) {
        lastSaveTime.current = now;
        try {
          // 获取当前画面的快照
          const canvas = document.createElement('canvas');
          const video = videoRef.current;
          if (video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              const snapshotData = canvas.toDataURL('image/jpeg', 0.8);
              
              // 保存记录
              saveDetectionMutation.mutate({
                personId: detectedFaces.length > 0 && detectedFaces[0].name !== "未知" ? persons?.find(p => p.name === detectedFaces[0].name)?.id : undefined,
                personName: detectedFaces.length > 0 ? detectedFaces[0].name : undefined,
                confidence: detectedFaces.length > 0 ? Math.round(detectedFaces[0].confidence) : undefined,
                detectedObjects: JSON.stringify(predictions.map(p => ({
                  class: p.class,
                  score: Math.round(p.score * 100)
                }))),
                snapshotData: snapshotData
              });
            }
          }
        } catch (error) {
          console.error('Failed to save detection log:', error);
        }
      }

      // 绘制检测框
      drawDetections(predictions, detectedFaces);

      // 继续检测
      requestAnimationFrame(detectLoop);
    } catch (error) {
      console.error("Detection error:", error);
      requestAnimationFrame(detectLoop); // 继续尝试
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
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // 绘制标签背景
      ctx.fillStyle = "#00ff00";
      const label = `${prediction.class === "person" ? "人" : prediction.class} ${(
        prediction.score * 100
      ).toFixed(0)}%`;
      ctx.font = "bold 18px Arial";
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x, y - 30, textWidth + 10, 30);

      // 绘制标签文字
      ctx.fillStyle = "#000000";
      ctx.fillText(label, x + 5, y - 8);
    });

    // 绘制人脸检测框（黄色正方形）
    faces.forEach((face) => {
      const [x, y, size] = face.bbox;

      // 绘制正方形边界框
      ctx.strokeStyle = "#ffff00";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, size, size);

      // 绘制标签背景
      ctx.fillStyle = "#ffff00";
      const label = face.name !== "未知" 
        ? `${face.name} ${face.confidence.toFixed(0)}%`
        : "未知人脸";
      ctx.font = "bold 20px Arial";
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x, y - 35, textWidth + 15, 35);

      // 绘制标签文字
      ctx.fillStyle = "#000000";
      ctx.fillText(label, x + 7, y - 10);
      
      // 在正方形四个角添加装饰
      const cornerSize = 20;
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 3;
      
      // 左上角
      ctx.beginPath();
      ctx.moveTo(x, y + cornerSize);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerSize, y);
      ctx.stroke();
      
      // 右上角
      ctx.beginPath();
      ctx.moveTo(x + size - cornerSize, y);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x + size, y + cornerSize);
      ctx.stroke();
      
      // 左下角
      ctx.beginPath();
      ctx.moveTo(x, y + size - cornerSize);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x + cornerSize, y + size);
      ctx.stroke();
      
      // 右下角
      ctx.beginPath();
      ctx.moveTo(x + size - cornerSize, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x + size, y + size - cornerSize);
      ctx.stroke();
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* 顶部栏 */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            实时物体与人脸识别系统
          </h1>
          <p className="text-gray-400 text-xs md:text-sm">
            使用 TensorFlow.js 进行实时物体检测和人脸识别
          </p>
        </div>

        {/* 主要内容区 - 左右布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* 左侧：识别结果和统计 */}
          <div className="lg:col-span-1 space-y-4 md:space-y-6 order-2 lg:order-1">
            {/* 统计卡片 */}
            {stats && (
              <Card className="bg-gray-800/50 border-gray-700 p-4 md:p-6">
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
              <Card className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 p-4 md:p-6">
                <h3 className="text-xl font-semibold text-white mb-3">
                  🎯 人脸识别结果
                </h3>
                <div className="space-y-3">
                  {faceDetections.map((face, index) => (
                    <div key={index} className="bg-gray-700/50 rounded-lg p-4 border-l-4 border-yellow-400">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-2xl font-bold text-white">
                          {face.name}
                        </span>
                        {face.name !== "未知" && (
                          <span className="text-lg font-semibold text-yellow-400">
                            {face.confidence.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">
                        {face.name !== "未知" ? "已识别身份" : "未在数据库中"}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 检测到的物体列表 */}
            <Card className="bg-gray-800/50 border-gray-700 p-4 md:p-6">
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
          <div className="lg:col-span-2 space-y-4 md:space-y-6 order-1 lg:order-2">
            {/* 视频显示区 */}
            <Card className="bg-gray-800/50 border-gray-700 p-3 md:p-6">
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
              <div className="flex gap-2 md:gap-3 mt-3 md:mt-4">
                {!isDetecting ? (
                  <Button
                    onClick={startDetection}
                    disabled={!model}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-base md:text-lg py-4 md:py-6"
                  >
                    {model ? "开始检测" : "模型加载中..."}
                  </Button>
                ) : (
                  <Button
                    onClick={stopDetection}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-base md:text-lg py-4 md:py-6"
                  >
                    停止检测
                  </Button>
                )}
              </div>
            </Card>

            {/* 功能说明 */}
            <Card className="bg-gray-800/50 border-gray-700 p-4 md:p-6 hidden md:block">
              <h3 className="text-lg font-semibold text-white mb-3">
                功能说明
              </h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• 实时检测画面中的物体（绿色框，支持 80 种物体类别）</li>
                <li>• 自动识别已录入的人脸并显示姓名（黄色正方形框）</li>
                <li>• AI 智能比对后台数据库，精准识别来者身份</li>
                <li>• 管理员可访问后台页面添加人员信息</li>
                <li>• 所有处理都在浏览器本地完成，保护隐私</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

