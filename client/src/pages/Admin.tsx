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
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { extractFaceFromImage } from "@/lib/faceRecognition";

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!name || !imagePreview) {
      toast.error("请填写姓名并上传照片");
      return;
    }

    try {
      // 提取人脸特征
      toast.info("正在提取人脸特征...");
      const img = new Image();
      img.src = imagePreview;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const faceEmbedding = await extractFaceFromImage(img);
      
      if (!faceEmbedding) {
        toast.error("未检测到人脸，请上传清晰的人脸照片");
        return;
      }

      createMutation.mutate({
        name,
        description,
        imageData: imagePreview,
        faceEmbedding: JSON.stringify(faceEmbedding),
      });
    } catch (error) {
      toast.error("人脸特征提取失败，请重试");
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
            <h1 className="text-4xl font-bold text-white mb-2">人员管理</h1>
            <p className="text-gray-400">管理人脸识别数据库中的人员信息</p>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            添加人员
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center text-white">加载中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {persons?.map((person) => (
              <Card
                key={person.id}
                className="bg-gray-800/50 border-gray-700 overflow-hidden"
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
                    <p className="text-gray-400 text-sm mb-4">
                      {person.description}
                    </p>
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>添加新人员</DialogTitle>
              <DialogDescription className="text-gray-400">
                上传人员照片并填写基本信息
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
      </div>
    </div>
  );
}

