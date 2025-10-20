import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { extractFaceFromImage } from "@/lib/faceRecognition";
import {
  batchExtractFaces,
  validateFaceQuality,
  exportFaceData,
  importFaceData,
  prepareTrainingData,
  calculateEmbeddingQuality,
} from "@/lib/faceTraining";

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [faceQuality, setFaceQuality] = useState<{
    valid: boolean;
    score: number;
    issues: string[];
  } | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: persons, isLoading } = trpc.persons.list.useQuery();
  
  const createMutation = trpc.persons.create.useMutation({
    onSuccess: () => {
      toast.success("人员添加成功");
      utils.persons.list.invalidate();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "添加失败");
    },
  });

  const deleteMutation = trpc.persons.delete.useMutation({
    onSuccess: () => {
      toast.success("人员删除成功");
      utils.persons.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "删除失败");
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setImagePreview("");
    setFaceQuality(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件大小(限制5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片文件过大,请选择小于5MB的图片");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // 检查文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);

      // 验证人脸质量
      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        toast.info("正在检测人脸质量...");
        const quality = await validateFaceQuality(img);
        setFaceQuality(quality);
        
        if (quality.valid) {
          toast.success(`人脸质量良好 (${quality.score}/100)`);
        } else {
          toast.warning(`人脸质量较低 (${quality.score}/100): ${quality.issues.join(", ")}`);
        }
      };
      img.onerror = () => {
        toast.error("图片加载失败,请选择其他图片");
        setImagePreview("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      };
    };
    reader.onerror = () => {
      toast.error("文件读取失败,请重试");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!name || !imagePreview) {
      toast.error("请填写姓名并上传照片");
      return;
    }

    if (faceQuality && !faceQuality.valid) {
      const confirm = window.confirm(
        `人脸质量评分较低 (${faceQuality.score}/100)，是否继续？\n问题：${faceQuality.issues.join(", ")}`
      );
      if (!confirm) return;
    }

    try {
      toast.info("正在加载人脸检测模型...");
      
      const img = new Image();
      img.src = imagePreview;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("图片加载失败"));
      });

      toast.info("正在提取人脸特征...");
      const faceEmbedding = await extractFaceFromImage(img);
      
      if (!faceEmbedding) {
        toast.error(
          "未检测到人脸，请确保:\n" +
          "1. 照片中有清晰的人脸\n" +
          "2. 人脸正对镜头\n" +
          "3. 光线充足\n" +
          "4. 人脸占图牃30%以上"
        );
        return;
      }

      // 计算特征质量
      const embeddingQuality = calculateEmbeddingQuality(faceEmbedding);
      toast.success(`人脸特征提取成功! 特征质量: ${embeddingQuality.toFixed(1)}/100`);

      toast.info("正在保存...");
      createMutation.mutate({
        name,
        description,
        imageData: imagePreview,
        faceEmbedding: JSON.stringify(faceEmbedding),
      });
    } catch (error) {
      console.error("人脸特征提取错误:", error);
      if (error instanceof Error) {
        toast.error(`错误: ${error.message}`);
      } else {
        toast.error("人脸特征提取失败，请重试");
      }
    }
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setBatchFiles(files);
  };

  const handleBatchProcess = async () => {
    if (batchFiles.length === 0) {
      toast.error("请选择要上传的图片");
      return;
    }

    setIsProcessing(true);
    toast.info(`开始处理 ${batchFiles.length} 张图片...`);

    try {
      // 从文件名提取姓名
      const images = batchFiles.map((file) => ({
        name: file.name.replace(/\.[^/.]+$/, ""), // 移除扩展名
        file,
      }));

      const results = await batchExtractFaces(images);

      let successCount = 0;
      let failCount = 0;

      for (const result of results) {
        if (result.embedding) {
          try {
            // 读取图片为 base64
            const reader = new FileReader();
            const file = batchFiles.find((f) =>
              f.name.startsWith(result.name)
            );
            if (!file) continue;

            const imageData = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });

            await createMutation.mutateAsync({
              name: result.name,
              description: "",
              imageData,
              faceEmbedding: JSON.stringify(result.embedding),
            });

            successCount++;
          } catch (error) {
            failCount++;
          }
        } else {
          failCount++;
          toast.error(`${result.name}: ${result.error}`);
        }
      }

      toast.success(`批量导入完成！成功: ${successCount}, 失败: ${failCount}`);
      setIsBatchDialogOpen(false);
      setBatchFiles([]);
      utils.persons.list.invalidate();
    } catch (error) {
      toast.error("批量处理失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportData = () => {
    if (!persons || persons.length === 0) {
      toast.error("没有可导出的数据");
      return;
    }

    const faceData = persons
      .filter((p) => p.faceEmbedding)
      .map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        embedding: JSON.parse(p.faceEmbedding!),
      }));

    const jsonData = exportFaceData(faceData);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `face-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("数据导出成功");
  };

  const handleValidateData = async () => {
    if (!persons || persons.length === 0) {
      toast.error("没有可验证的数据");
      return;
    }

    toast.info("正在验证人脸数据...");

    const faceData = persons
      .filter((p) => p.faceEmbedding)
      .map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        embedding: JSON.parse(p.faceEmbedding!),
      }));

    const result = await prepareTrainingData(faceData);

    if (result.success) {
      toast.success(
        `验证完成！有效: ${result.validFaces}, 无效: ${result.invalidFaces}`
      );
    } else {
      toast.error(
        `验证失败！有效: ${result.validFaces}, 无效: ${result.invalidFaces}`
      );
      result.errors.forEach((error) => toast.error(error));
    }
  };

  const handleDelete = (id: number, personName: string) => {
    if (confirm(`确定要删除 ${personName} 吗？`)) {
      deleteMutation.mutate({ id });
    }
  };

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
          <p className="text-gray-400 mb-6">请先登录以访问管理功能</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>
            登录
          </Button>
        </Card>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Card className="bg-gray-800/50 border-gray-700 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">权限不足</h2>
          <p className="text-gray-400">只有管理员可以访问此页面</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">人员管理系统</h1>
            <p className="text-gray-400">管理人脸识别数据库中的人员信息和训练数据</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => setIsBatchDialogOpen(true)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              批量导入
            </Button>
            <Button
              onClick={handleExportData}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              导出数据
            </Button>
            <Button
              onClick={handleValidateData}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              验证数据
            </Button>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              添加人员
            </Button>
          </div>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="bg-gray-800/50 border-gray-700">
            <TabsTrigger value="list">人员列表</TabsTrigger>
            <TabsTrigger value="stats">数据统计</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            {isLoading ? (
              <div className="text-center text-white">加载中...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {persons?.map((person) => (
                  <Card
                    key={person.id}
                    className="bg-gray-800/50 border-gray-700 overflow-hidden hover:border-gray-600 transition"
                  >
                    <img
                      src={person.imageUrl}
                      alt={person.name}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {person.name}
                      </h3>
                      {person.description && (
                        <p className="text-gray-400 text-sm mb-3">
                          {person.description}
                        </p>
                      )}
                      {person.faceEmbedding && (
                        <div className="text-xs text-gray-500 mb-3">
                          特征向量: {JSON.parse(person.faceEmbedding).length} 维
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(person.id, person.name)}
                          disabled={deleteMutation.isPending}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {persons?.length === 0 && (
              <Card className="bg-gray-800/50 border-gray-700 p-12 text-center">
                <p className="text-gray-400 text-lg">
                  还没有添加任何人员，点击上方按钮开始添加
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gray-800/50 border-gray-700 p-6">
                <h3 className="text-gray-400 text-sm mb-2">总人数</h3>
                <p className="text-3xl font-bold text-white">{persons?.length || 0}</p>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700 p-6">
                <h3 className="text-gray-400 text-sm mb-2">已训练</h3>
                <p className="text-3xl font-bold text-green-400">
                  {persons?.filter((p) => p.faceEmbedding).length || 0}
                </p>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700 p-6">
                <h3 className="text-gray-400 text-sm mb-2">未训练</h3>
                <p className="text-3xl font-bold text-yellow-400">
                  {persons?.filter((p) => !p.faceEmbedding).length || 0}
                </p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* 添加单个人员对话框 */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加新人员</DialogTitle>
              <DialogDescription className="text-gray-400">
                上传人员照片并填写基本信息，系统会自动提取人脸特征
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入姓名"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="description">描述（可选）</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请输入描述信息"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="image">照片</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              {imagePreview && (
                <div className="mt-4">
                  <img
                    src={imagePreview}
                    alt="预览"
                    className="w-full h-48 object-cover rounded"
                  />
                  {faceQuality && (
                    <div className={`mt-2 p-3 rounded ${faceQuality.valid ? 'bg-green-500/10 border border-green-500/50' : 'bg-yellow-500/10 border border-yellow-500/50'}`}>
                      <p className={`text-sm font-semibold ${faceQuality.valid ? 'text-green-400' : 'text-yellow-400'}`}>
                        人脸质量评分: {faceQuality.score}/100
                      </p>
                      {faceQuality.issues.length > 0 && (
                        <ul className="text-xs text-gray-400 mt-1">
                          {faceQuality.issues.map((issue, idx) => (
                            <li key={idx}>• {issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending ? "添加中..." : "添加"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 批量导入对话框 */}
        <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>批量导入人员</DialogTitle>
              <DialogDescription className="text-gray-400">
                选择多张人脸照片，文件名将作为人员姓名
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="batch-images">选择图片</Label>
                <Input
                  id="batch-images"
                  type="file"
                  accept="image/*"
                  multiple
                  ref={batchInputRef}
                  onChange={handleBatchUpload}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              {batchFiles.length > 0 && (
                <div className="text-gray-400 text-sm">
                  已选择 {batchFiles.length} 张图片
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsBatchDialogOpen(false);
                  setBatchFiles([]);
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleBatchProcess}
                disabled={isProcessing || batchFiles.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? "处理中..." : "开始导入"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

