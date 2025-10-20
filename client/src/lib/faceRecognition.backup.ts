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
      solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619",
      maxFaces: 10, // 增加最大检测人脸数
      refineLandmarks: true, // 启用精细化关键点检测
    };
    detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
    console.log("Face detector initialized successfully");
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
    staticImageMode: false,
  });

  return faces;
}

/**
 * 增强版：从人脸关键点生成更精确的特征向量
 * 使用多个特征组合提高识别准确度
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

  // 1. 归一化关键点坐标（相对于人脸中心）
  const normalizedPoints = keypoints.map(p => [
    (p.x - centerX) / width,
    (p.y - centerY) / height,
  ]).flat();

  // 2. 计算关键特征点之间的距离比例
  const featureDistances: number[] = [];
  
  // 重要特征点索引（眼睛、鼻子、嘴巴）
  const importantIndices = [
    33, 133, // 左眼
    362, 263, // 右眼
    1, 4, // 鼻子
    61, 291, // 嘴巴
    234, 454, // 脸颊
  ];

  for (let i = 0; i < importantIndices.length; i++) {
    for (let j = i + 1; j < importantIndices.length; j++) {
      const p1 = keypoints[importantIndices[i]];
      const p2 = keypoints[importantIndices[j]];
      const dist = Math.sqrt(
        Math.pow((p1.x - p2.x) / width, 2) + 
        Math.pow((p1.y - p2.y) / height, 2)
      );
      featureDistances.push(dist);
    }
  }

  // 3. 计算人脸的几何特征
  const geometricFeatures = [
    width / height, // 脸型比例
    (keypoints[33].x - keypoints[133].x) / width, // 左眼宽度
    (keypoints[362].x - keypoints[263].x) / width, // 右眼宽度
    (keypoints[61].y - keypoints[291].y) / height, // 嘴巴高度
    (keypoints[234].x - keypoints[454].x) / width, // 脸宽
  ];

  // 组合所有特征
  const embedding = [
    ...normalizedPoints.slice(0, 100), // 使用前50个关键点（100个坐标值）
    ...featureDistances,
    ...geometricFeatures,
  ];

  return embedding;
}

/**
 * 增强版：计算两个特征向量之间的加权欧氏距离
 */
export function calculateDistance(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    console.warn(`Embedding length mismatch: ${embedding1.length} vs ${embedding2.length}`);
    // 如果长度不匹配，使用较短的长度
    const minLength = Math.min(embedding1.length, embedding2.length);
    embedding1 = embedding1.slice(0, minLength);
    embedding2 = embedding2.slice(0, minLength);
  }

  let sum = 0;
  const weights = new Array(embedding1.length).fill(1);
  
  // 对重要特征赋予更高权重
  // 前100个值是关键点坐标，权重为1
  // 后面的距离特征权重为2（更重要）
  for (let i = 100; i < Math.min(embedding1.length, 200); i++) {
    weights[i] = 2;
  }
  // 几何特征权重为3（最重要）
  for (let i = 200; i < embedding1.length; i++) {
    weights[i] = 3;
  }

  let totalWeight = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff * weights[i];
    totalWeight += weights[i];
  }

  return Math.sqrt(sum / totalWeight);
}

/**
 * 增强版：比对人脸，返回最相似的人员和相似度
 * 使用更智能的阈值和多重验证
 */
export function matchFace(
  faceEmbedding: number[],
  knownFaces: Array<{ id: number; name: string; embedding: number[] }>,
  threshold: number = 0.4 // 降低阈值，提高识别率
): { id: number; name: string; similarity: number } | null {
  if (knownFaces.length === 0) {
    return null;
  }

  let bestMatch: { id: number; name: string; similarity: number; distance: number } | null = null;
  let minDistance = Infinity;

  for (const known of knownFaces) {
    try {
      const distance = calculateDistance(faceEmbedding, known.embedding);
      
      // 将距离转换为相似度 (0-100)
      // 使用更合理的转换公式
      const similarity = Math.max(0, Math.min(100, (1 - distance / 3) * 100));

      console.log(`Comparing with ${known.name}: distance=${distance.toFixed(4)}, similarity=${similarity.toFixed(2)}%`);

      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = {
          id: known.id,
          name: known.name,
          similarity: Math.round(similarity),
          distance: distance,
        };
      }
    } catch (error) {
      console.error(`Error comparing with ${known.name}:`, error);
    }
  }

  // 使用动态阈值：如果只有一个候选人且相似度不太低，也认为匹配
  const dynamicThreshold = knownFaces.length === 1 ? threshold * 0.7 : threshold;
  
  if (bestMatch && bestMatch.similarity >= dynamicThreshold * 100) {
    console.log(`✓ Match found: ${bestMatch.name} (${bestMatch.similarity}%, distance=${bestMatch.distance.toFixed(4)})`);
    return {
      id: bestMatch.id,
      name: bestMatch.name,
      similarity: bestMatch.similarity,
    };
  }

  console.log(`✗ No match found (best: ${bestMatch?.name} ${bestMatch?.similarity}%, threshold: ${(dynamicThreshold * 100).toFixed(0)}%)`);
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

    // 使用第一个检测到的人脸
    const embedding = extractFaceEmbedding(faces[0]);
    console.log(`Face embedding extracted: ${embedding.length} features`);
    return embedding;
  } catch (error) {
    console.error("Error extracting face from image:", error);
    return null;
  }
}

