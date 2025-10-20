import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";

let detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;

/**
 * 初始化人脸检测模型
 */
export async function initFaceDetector() {
  if (detector) return detector;

  try {
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshMediaPipeModelConfig = {
      runtime: "mediapipe",
      solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh",
      maxFaces: 5,
      refineLandmarks: false,
    };
    detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
    return detector;
  } catch (error) {
    console.error("Failed to load face detector:", error);
    throw error;
  }
}

/**
 * 从视频或图像中检测人脸
 */
export async function detectFaces(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
) {
  if (!detector) {
    detector = await initFaceDetector();
  }

  const faces = await detector.estimateFaces(input, {
    flipHorizontal: false,
  });

  return faces;
}

/**
 * 从人脸关键点生成简单的特征向量
 * 这是一个简化的实现，实际应用中应该使用更复杂的人脸识别模型
 */
export function extractFaceEmbedding(face: faceLandmarksDetection.Face): number[] {
  // 使用关键点的归一化坐标作为特征
  const keypoints = face.keypoints;
  
  // 计算人脸边界框
  const xs = keypoints.map(p => p.x);
  const ys = keypoints.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  // 归一化关键点坐标
  const normalized = keypoints.map(p => [
    (p.x - minX) / width,
    (p.y - minY) / height,
  ]).flat();

  return normalized;
}

/**
 * 计算两个特征向量之间的欧氏距离
 */
export function calculateDistance(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error("Embeddings must have the same length");
  }

  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * 比对人脸，返回最相似的人员和相似度
 */
export function matchFace(
  faceEmbedding: number[],
  knownFaces: Array<{ id: number; name: string; embedding: number[] }>,
  threshold: number = 0.6
): { id: number; name: string; similarity: number } | null {
  let bestMatch: { id: number; name: string; similarity: number } | null = null;
  let minDistance = Infinity;

  for (const known of knownFaces) {
    const distance = calculateDistance(faceEmbedding, known.embedding);
    
    // 将距离转换为相似度 (0-100)
    // 距离越小，相似度越高
    const similarity = Math.max(0, Math.min(100, (1 - distance / 2) * 100));

    if (distance < minDistance && similarity >= threshold * 100) {
      minDistance = distance;
      bestMatch = {
        id: known.id,
        name: known.name,
        similarity: Math.round(similarity),
      };
    }
  }

  return bestMatch;
}

/**
 * 从图像元素中提取人脸特征
 */
export async function extractFaceFromImage(
  imageElement: HTMLImageElement
): Promise<number[] | null> {
  const faces = await detectFaces(imageElement);
  
  if (faces.length === 0) {
    return null;
  }

  // 使用第一个检测到的人脸
  return extractFaceEmbedding(faces[0]);
}

