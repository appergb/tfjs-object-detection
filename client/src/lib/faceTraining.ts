/**
 * 人脸特征提取和训练工具
 * 用于后台管理系统的人脸数据处理
 */

import { extractFaceFromImage, detectFaces, extractFaceEmbedding } from "./faceRecognition";

export interface FaceData {
  id: number;
  name: string;
  imageUrl: string;
  embedding: number[];
  confidence?: number;
}

export interface TrainingResult {
  success: boolean;
  totalFaces: number;
  validFaces: number;
  invalidFaces: number;
  errors: string[];
}

/**
 * 批量提取人脸特征
 */
export async function batchExtractFaces(
  images: Array<{ name: string; file: File }>
): Promise<Array<{ name: string; embedding: number[] | null; error?: string }>> {
  const results = [];

  for (const { name, file } of images) {
    try {
      // 读取图片
      const imageUrl = await readFileAsDataURL(file);
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // 提取人脸特征
      const embedding = await extractFaceFromImage(img);

      if (embedding) {
        results.push({ name, embedding });
      } else {
        results.push({ name, embedding: null, error: "未检测到人脸" });
      }
    } catch (error) {
      results.push({
        name,
        embedding: null,
        error: error instanceof Error ? error.message : "处理失败",
      });
    }
  }

  return results;
}

/**
 * 验证人脸质量
 */
export async function validateFaceQuality(imageElement: HTMLImageElement): Promise<{
  valid: boolean;
  score: number;
  issues: string[];
}> {
  const issues: string[] = [];
  let score = 100;

  try {
    const faces = await detectFaces(imageElement);

    if (faces.length === 0) {
      return { valid: false, score: 0, issues: ["未检测到人脸"] };
    }

    if (faces.length > 1) {
      issues.push("检测到多张人脸，将使用第一张");
      score -= 20;
    }

    const face = faces[0];
    const keypoints = face.keypoints;

    // 计算人脸边界框
    const xs = keypoints.map((p) => p.x);
    const ys = keypoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;

    // 检查人脸大小
    const imageArea = imageElement.width * imageElement.height;
    const faceArea = width * height;
    const faceRatio = faceArea / imageArea;

    if (faceRatio < 0.1) {
      issues.push("人脸过小，建议使用更清晰的照片");
      score -= 30;
    }

    if (faceRatio > 0.8) {
      issues.push("人脸过大，建议保留更多背景");
      score -= 10;
    }

    // 检查人脸位置（是否居中）
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const imageCenterX = imageElement.width / 2;
    const imageCenterY = imageElement.height / 2;
    const offsetX = Math.abs(centerX - imageCenterX) / imageElement.width;
    const offsetY = Math.abs(centerY - imageCenterY) / imageElement.height;

    if (offsetX > 0.3 || offsetY > 0.3) {
      issues.push("人脸未居中");
      score -= 15;
    }

    return {
      valid: score >= 50,
      score,
      issues,
    };
  } catch (error) {
    return {
      valid: false,
      score: 0,
      issues: ["人脸检测失败"],
    };
  }
}

/**
 * 计算特征向量的质量分数
 */
export function calculateEmbeddingQuality(embedding: number[]): number {
  // 计算向量的标准差，标准差越大说明特征越明显
  const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
  const variance =
    embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    embedding.length;
  const stdDev = Math.sqrt(variance);

  // 归一化到 0-100
  return Math.min(100, stdDev * 100);
}

/**
 * 比较两个特征向量的相似度
 */
export function compareFaceEmbeddings(
  embedding1: number[],
  embedding2: number[]
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error("特征向量长度不匹配");
  }

  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }

  const distance = Math.sqrt(sum);
  // 将距离转换为相似度 (0-100)
  const similarity = Math.max(0, Math.min(100, (1 - distance / 2) * 100));

  return Math.round(similarity);
}

/**
 * 训练人脸识别模型（准备数据）
 */
export async function prepareTrainingData(
  faceDataList: FaceData[]
): Promise<TrainingResult> {
  const result: TrainingResult = {
    success: true,
    totalFaces: faceDataList.length,
    validFaces: 0,
    invalidFaces: 0,
    errors: [],
  };

  for (const faceData of faceDataList) {
    try {
      // 验证特征向量
      if (!faceData.embedding || faceData.embedding.length === 0) {
        result.invalidFaces++;
        result.errors.push(`${faceData.name}: 缺少特征向量`);
        continue;
      }

      // 计算特征质量
      const quality = calculateEmbeddingQuality(faceData.embedding);
      if (quality < 30) {
        result.invalidFaces++;
        result.errors.push(`${faceData.name}: 特征质量过低 (${quality})`);
        continue;
      }

      result.validFaces++;
    } catch (error) {
      result.invalidFaces++;
      result.errors.push(
        `${faceData.name}: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  result.success = result.validFaces > 0 && result.invalidFaces === 0;

  return result;
}

/**
 * 优化特征向量（降维或归一化）
 */
export function optimizeEmbedding(embedding: number[]): number[] {
  // L2 归一化
  const norm = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );

  if (norm === 0) return embedding;

  return embedding.map((val) => val / norm);
}

/**
 * 读取文件为 DataURL
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 导出人脸数据为 JSON
 */
export function exportFaceData(faceDataList: FaceData[]): string {
  const exportData = faceDataList.map((face) => ({
    id: face.id,
    name: face.name,
    embedding: face.embedding,
  }));

  return JSON.stringify(exportData, null, 2);
}

/**
 * 从 JSON 导入人脸数据
 */
export function importFaceData(jsonString: string): FaceData[] {
  try {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) {
      throw new Error("无效的数据格式");
    }

    return data.map((item) => ({
      id: item.id || 0,
      name: item.name || "未知",
      imageUrl: item.imageUrl || "",
      embedding: item.embedding || [],
    }));
  } catch (error) {
    throw new Error("导入失败: " + (error instanceof Error ? error.message : "未知错误"));
  }
}

