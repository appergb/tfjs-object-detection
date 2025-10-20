import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";

let detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;
let isInitializing = false;

/**
 * 优化：使用单例模式和初始化锁，避免重复加载模型
 */
export async function initFaceDetector() {
  if (detector) return detector;
  
  // 防止并发初始化
  if (isInitializing) {
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (detector || !isInitializing) {
          clearInterval(checkInterval);
          resolve(detector);
        }
      }, 100);
    });
    return detector;
  }

  isInitializing = true;
  try {
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshMediaPipeModelConfig = {
      runtime: "mediapipe",
      solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh",
      maxFaces: 5, // 优化：减少最大检测人脸数以提高性能
      refineLandmarks: false, // 优化：关闭精细化检测以提升速度
    };
    detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
    console.log("Face detector initialized successfully");
    return detector;
  } catch (error) {
    console.error("Failed to load face detector:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * 优化：添加缓存机制，减少重复计算
 */
const detectionCache = new Map<string, { faces: faceLandmarksDetection.Face[], timestamp: number }>();
const CACHE_TTL = 100; // 缓存 100ms

export async function detectFaces(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
) {
  if (!detector) {
    detector = await initFaceDetector();
  }

  // 优化：对视频帧使用简单的缓存
  const cacheKey = input instanceof HTMLVideoElement ? `video-${input.currentTime}` : 'static';
  const cached = detectionCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.faces;
  }

  const faces = await detector.estimateFaces(input, {
    flipHorizontal: false,
    staticImageMode: input instanceof HTMLImageElement,
  });

  // 更新缓存
  detectionCache.set(cacheKey, { faces, timestamp: Date.now() });
  
  // 清理过期缓存
  if (detectionCache.size > 10) {
    const now = Date.now();
    for (const [key, value] of detectionCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        detectionCache.delete(key);
      }
    }
  }

  return faces;
}

/**
 * 优化：减少特征向量维度，提高计算效率
 */
export function extractFaceEmbedding(face: faceLandmarksDetection.Face): number[] {
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
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // 优化：只使用关键特征点，减少计算量
  const importantIndices = [
    33, 133, 362, 263, // 眼睛
    1, 4, 5, 195, // 鼻子
    61, 291, 17, 0, // 嘴巴和下巴
    234, 454, 10, 152, // 脸颊和额头
  ];

  // 1. 归一化关键点坐标
  const normalizedPoints: number[] = [];
  for (const idx of importantIndices) {
    const p = keypoints[idx];
    normalizedPoints.push(
      (p.x - centerX) / width,
      (p.y - centerY) / height
    );
  }

  // 2. 计算关键特征距离（优化：减少距离计算数量）
  const featureDistances: number[] = [];
  const distancePairs = [
    [33, 263], // 两眼距离
    [33, 133], [362, 263], // 眼睛宽度
    [1, 61], [1, 291], // 鼻子到嘴巴
    [234, 454], // 脸宽
    [10, 152], // 额头到下巴
  ];

  for (const [i, j] of distancePairs) {
    const p1 = keypoints[i];
    const p2 = keypoints[j];
    const dist = Math.sqrt(
      Math.pow((p1.x - p2.x) / width, 2) + 
      Math.pow((p1.y - p2.y) / height, 2)
    );
    featureDistances.push(dist);
  }

  // 3. 几何特征
  const geometricFeatures = [
    width / height, // 脸型比例
    (keypoints[33].x - keypoints[263].x) / width, // 眼距
    (keypoints[61].y - keypoints[10].y) / height, // 嘴巴到额头
  ];

  // 组合特征（优化后维度更小）
  return [...normalizedPoints, ...featureDistances, ...geometricFeatures];
}

/**
 * 优化：使用更快的距离计算方法
 */
export function calculateDistance(embedding1: number[], embedding2: number[]): number {
  const minLength = Math.min(embedding1.length, embedding2.length);
  let sum = 0;

  // 优化：简化权重计算，使用统一权重
  for (let i = 0; i < minLength; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum / minLength);
}

/**
 * 优化：使用更高效的匹配算法
 */
export function matchFace(
  faceEmbedding: number[],
  knownFaces: Array<{ id: number; name: string; embedding: number[] }>,
  threshold: number = 0.35 // 优化阈值
): { id: number; name: string; similarity: number } | null {
  if (knownFaces.length === 0) return null;

  let bestMatch: { id: number; name: string; similarity: number } | null = null;
  let minDistance = Infinity;

  // 优化：使用 for 循环代替 forEach，性能更好
  for (let i = 0; i < knownFaces.length; i++) {
    const known = knownFaces[i];
    try {
      const distance = calculateDistance(faceEmbedding, known.embedding);
      
      if (distance < minDistance) {
        minDistance = distance;
        // 优化相似度计算公式
        const similarity = Math.max(0, Math.min(100, (1 - distance / 2.5) * 100));
        bestMatch = {
          id: known.id,
          name: known.name,
          similarity: Math.round(similarity),
        };
      }
    } catch (error) {
      console.error(`Error comparing with ${known.name}:`, error);
    }
  }

  // 动态阈值
  const dynamicThreshold = knownFaces.length === 1 ? threshold * 0.8 : threshold;
  
  if (bestMatch && bestMatch.similarity >= dynamicThreshold * 100) {
    return bestMatch;
  }

  return null;
}

/**
 * 从图像元素中提取人脸特征
 */
export async function extractFaceFromImage(
  imageElement: HTMLImageElement
): Promise<number[] | null> {
  try {
    const faces = await detectFaces(imageElement);
    
    if (faces.length === 0) {
      console.warn("No face detected in image");
      return null;
    }

    if (faces.length > 1) {
      console.warn(`Multiple faces detected (${faces.length}), using the first one`);
    }

    const embedding = extractFaceEmbedding(faces[0]);
    console.log(`Face embedding extracted: ${embedding.length} features`);
    return embedding;
  } catch (error) {
    console.error("Error extracting face from image:", error);
    return null;
  }
}

/**
 * 优化：清理资源
 */
export function cleanup() {
  detectionCache.clear();
  // 注意：detector 不应该被清理，因为重新加载模型代价很高
}

