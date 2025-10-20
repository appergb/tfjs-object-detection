import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { extractFaceFromImage, initFaceDetector } from "@/lib/faceRecognition";
import { validateFaceQuality } from "@/lib/faceTraining";

export default function BackendAdmin() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [personName, setPersonName] = useState("");
  const [personDescription, setPersonDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const { data: persons, refetch: refetchPersons } = trpc.persons.list.useQuery();
  const { data: stats } = trpc.stats.getOverview.useQuery();
  const createPersonMutation = trpc.persons.create.useMutation();
  const deletePersonMutation = trpc.persons.delete.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setBatchFiles(files);
    toast.info(`已选择 ${files.length} 个文件`);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !personName.trim()) {
      toast.error("请选择图片并输入姓名");
      return;
    }

    setIsProcessing(true);

    try {
      // 初始化人脸检测器
      await initFaceDetector();

      // 读取图片
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imageData = event.target?.result as string;
          
          // 创建图片元素
          const img = new Image();
          img.onload = async () => {
            try {
              // 验证人脸质量
              const quality = await validateFaceQuality(img);
              
              if (!quality.valid) {
                toast.error(`人脸质量不合格：${quality.issues.join(", ")}`);
                setIsProcessing(false);
                return;
              }

              if (quality.score < 60) {
                toast.warning(`人脸质量较低（评分：${quality.score}），建议重新拍摄`);
              }

              // 提取人脸特征
              const embedding = await extractFaceFromImage(img);
              
              if (!embedding) {
                toast.error("未检测到人脸，请使用包含清晰人脸的照片");
                setIsProcessing(false);
                return;
              }

              // 创建人员记录
              await createPersonMutation.mutateAsync({
                name: personName.trim(),
                description: personDescription.trim() || undefined,
                imageData,
                faceEmbedding: JSON.stringify(embedding),
              });

              toast.success(`成功添加人员：${personName}`);
              
              // 重置表单
              setSelectedFile(null);
              setPreviewUrl("");
              setPersonName("");
              setPersonDescription("");
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }

              // 刷新列表
              refetchPersons();
            } catch (error: any) {
              toast.error(error.message || "添加失败");
            } finally {
              setIsProcessing(false);
            }
          };
          img.src = imageData;
        } catch (error: any) {
          toast.error(error.message || "处理失败");
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error: any) {
      toast.error(error.message || "初始化失败");
      setIsProcessing(false);
    }
  };

  const handleBatchImport = async () => {
    if (batchFiles.length === 0) {
      toast.error("请选择要导入的图片");
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      await initFaceDetector();

      for (const file of batchFiles) {
        try {
          // 从文件名提取姓名
          const fileName = file.name.replace(/\.(jpg|jpeg|png|gif)$/i, "");
          
          const imageData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });

          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = imageData;
          });

          const embedding = await extractFaceFromImage(img);
          
          if (!embedding) {
            failCount++;
            continue;
          }

          await createPersonMutation.mutateAsync({
            name: fileName,
            description: `批量导入 - ${new Date().toLocaleDateString()}`,
            imageData,
            faceEmbedding: JSON.stringify(embedding),
          });

          successCount++;
        } catch (error) {
          failCount++;
        }
      }

      toast.success(`批量导入完成！成功：${successCount}，失败：${failCount}`);
      
      // 重置
      setBatchFiles([]);
      if (batchInputRef.current) {
        batchInputRef.current.value = "";
      }
      
      refetchPersons();
    } catch (error: any) {
      toast.error(error.message || "批量导入失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除 ${name} 吗？`)) {
      return;
    }

    try {
      await deletePersonMutation.mutateAsync({ id });
      toast.success(`已删除：${name}`);
      refetchPersons();
    } catch (error: any) {
      toast.error(error.message || "删除失败");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* 顶部标题 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            后台管理系统
          </h1>
          <p className="text-gray-400">
            管理人脸数据库，添加、编辑和删除人员信息
          </p>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/50 p-6">
              <div className="text-center">
                <p className="text-gray-300 text-sm mb-2">总人数</p>
                <p className="text-4xl font-bold text-blue-400">{stats.totalPersons}</p>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-green-500/50 p-6">
              <div className="text-center">
                <p className="text-gray-300 text-sm mb-2">总识别次数</p>
                <p className="text-4xl font-bold text-green-400">{stats.totalLogs}</p>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-yellow-500/50 p-6">
              <div className="text-center">
                <p className="text-gray-300 text-sm mb-2">今日识别</p>
                <p className="text-4xl font-bold text-yellow-400">{stats.todayLogs}</p>
              </div>
            </Card>
          </div>
        )}

        {/* 主要内容 */}
        <Tabs defaultValue="add" className="space-y-6">
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="add" className="data-[state=active]:bg-gray-700">
              添加人员
            </TabsTrigger>
            <TabsTrigger value="batch" className="data-[state=active]:bg-gray-700">
              批量导入
            </TabsTrigger>
            <TabsTrigger value="list" className="data-[state=active]:bg-gray-700">
              人员列表
            </TabsTrigger>
          </TabsList>

          {/* 添加人员 */}
          <TabsContent value="add">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：表单 */}
              <Card className="bg-gray-800/50 border-gray-700 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  添加新人员
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-gray-300">
                      姓名 *
                    </Label>
                    <Input
                      id="name"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="请输入姓名"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-gray-300">
                      描述（可选）
                    </Label>
                    <Input
                      id="description"
                      value={personDescription}
                      onChange={(e) => setPersonDescription(e.target.value)}
                      placeholder="请输入描述信息"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="photo" className="text-gray-300">
                      人脸照片 *
                    </Label>
                    <Input
                      ref={fileInputRef}
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      请上传包含清晰人脸的照片（JPG、PNG 格式）
                    </p>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={isProcessing || !selectedFile || !personName}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isProcessing ? "处理中..." : "添加人员"}
                  </Button>
                </div>
              </Card>

              {/* 右侧：预览 */}
              <Card className="bg-gray-800/50 border-gray-700 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  照片预览
                </h3>
                <div className="bg-black rounded-lg overflow-hidden aspect-square flex items-center justify-center">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="预览"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <svg
                        className="w-24 h-24 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p>请选择照片</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 批量导入 */}
          <TabsContent value="batch">
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                批量导入人脸
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="batch-files" className="text-gray-300">
                    选择多个人脸照片
                  </Label>
                  <Input
                    ref={batchInputRef}
                    id="batch-files"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBatchFileSelect}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    文件名将作为人员姓名（如：张三.jpg → 姓名：张三）
                  </p>
                </div>

                {batchFiles.length > 0 && (
                  <div className="bg-gray-700/50 rounded p-4">
                    <p className="text-gray-300 mb-2">
                      已选择 {batchFiles.length} 个文件：
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {batchFiles.map((file, index) => (
                        <p key={index} className="text-gray-400 text-sm">
                          {index + 1}. {file.name}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleBatchImport}
                  disabled={isProcessing || batchFiles.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? "导入中..." : "开始批量导入"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* 人员列表 */}
          <TabsContent value="list">
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                已录入人员（{persons?.length || 0}）
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {persons && persons.length > 0 ? (
                  persons.map((person) => (
                    <Card
                      key={person.id}
                      className="bg-gray-700/50 border-gray-600 p-4"
                    >
                      <div className="aspect-square bg-black rounded-lg overflow-hidden mb-3">
                        <img
                          src={person.imageUrl}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h4 className="text-white font-semibold mb-1">
                        {person.name}
                      </h4>
                      {person.description && (
                        <p className="text-gray-400 text-sm mb-3">
                          {person.description}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(person.id, person.name)}
                        className="w-full border-red-500 text-red-400 hover:bg-red-500/20"
                      >
                        删除
                      </Button>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    暂无人员数据
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

