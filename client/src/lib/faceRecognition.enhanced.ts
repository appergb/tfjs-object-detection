/**
 * 增强版人脸识别算法
 * 优化目标:
 * 1. 提高识别准确性
 * 2. 降低比对失败率
 * 3. 提升检测速度
 * 4. 更好地识别录入的照片
 */

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";

let detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;
let isInitializing = false;
let initPromise: Promise<faceLandmarksDetection.FaceLandmarksDetector> | null = null;

/**
 * 初始化人脸检测模型(单例模式)
 */
export async function initFaceDetector() {
  if (detector) return detector;
  
  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshMediaPipeModelConfig = {
        runtime: "mediapipe",
        solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619",
        maxFaces: 10,
        refineLandmarks: true,
      };
      detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
      console.log("✓ Face detector initialized successfully");
      return detector;
    } catch (error) {
      console.error("✗ Failed to load face detector:", error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
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
    staticImageMode: input instanceof HTMLImageElement,
  });

  return faces;
}

/**
 * 优化版: 提取稳定的人脸特征向量
 * 重点优化:
 * 1. 使用更稳定的特征点
 * 2. 归一化处理减少光照影响
 * 3. 提取关键几何特征
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

  // 选择最稳定的关键特征点(眼睛、鼻子、嘴巴、脸颊)
  const stableIndices = [
    // 左眼
    33, 133, 160, 159, 158, 157, 173,
    // 右眼
    362, 263, 387, 386, 385, 384, 398,
    // 鼻子
    1, 4, 5, 6, 168, 197, 195,
    // 嘴巴
    61, 291, 0, 17, 269, 405, 314, 17, 84, 181,
    // 脸颊和下巴
    234, 454, 132, 361, 152, 377,
  ];

  // 1. 归一化关键点坐标(相对于人脸中心和尺寸)
  const normalizedPoints: number[] = [];
  for (const idx of stableIndices) {
    if (idx < keypoints.length) {
      const p = keypoints[idx];
      normalizedPoints.push(
        (p.x - centerX) / width,
        (p.y - centerY) / height
      );
    }
  }

  // 2. 计算关键距离比例(更稳定的特征)
  const distances: number[] = [];
  
  // 眼睛距离
  const leftEye = keypoints[33];
  const rightEye = keypoints[263];
  const eyeDistance = Math.sqrt(
    Math.pow((rightEye.x - leftEye.x) / width, 2) +
    Math.pow((rightEye.y - leftEye.y) / height, 2)
  );
  distances.push(eyeDistance);

  // 眼睛到鼻子的距离
  const nose = keypoints[1];
  const leftEyeToNose = Math.sqrt(
    Math.pow((nose.x - leftEye.x) / width, 2) +
    Math.pow((nose.y - leftEye.y) / height, 2)
  );
  const rightEyeToNose = Math.sqrt(
    Math.pow((nose.x - rightEye.x) / width, 2) +
    Math.pow((nose.y - rightEye.y) / height, 2)
  );
  distances.push(leftEyeToNose, rightEyeToNose);

  // 鼻子到嘴巴的距离
  const mouth = keypoints[0];
  const noseToMouth = Math.sqrt(
    Math.pow((mouth.x - nose.x) / width, 2) +
    Math.pow((mouth.y - nose.y) / height, 2)
  );
  distances.push(noseToMouth);

  // 嘴巴宽度
  const mouthLeft = keypoints[61];
  const mouthRight = keypoints[291];
  const mouthWidth = Math.sqrt(
    Math.pow((mouthRight.x - mouthLeft.x) / width, 2) +
    Math.pow((mouthRight.y - mouthLeft.y) / height, 2)
  );
  distances.push(mouthWidth);

  // 脸颊宽度
  const leftCheek = keypoints[234];
  const rightCheek = keypoints[454];
  const cheekWidth = Math.sqrt(
    Math.pow((rightCheek.x - leftCheek.x) / width, 2) +
    Math.pow((rightCheek.y - leftCheek.y) / height, 2)
  );
  distances.push(cheekWidth);

  // 3. 几何特征(人脸形状)
  const geometricFeatures = [
    width / height, // 脸型比例
    eyeDistance / cheekWidth, // 眼距/脸宽比
    noseToMouth / (maxY - minY), // 鼻嘴距离/脸高比
    mouthWidth / eyeDistance, // 嘴宽/眼距比
  ];

  // 组合所有特征
  const embedding = [...normalizedPoints, ...distances, ...geometricFeatures];
  
  return embedding;
}

/**
 * 优化版: 计算两个特征向量之间的距离
 * 使用加权欧氏距离,对重要特征赋予更高权重
 */
export function calculateDistance(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    console.warn(`Embedding length mismatch: ${embedding1.length} vs ${embedding2.length}`);
    const minLength = Math.min(embedding1.length, embedding2.length);
    embedding1 = embedding1.slice(0, minLength);
    embedding2 = embedding2.slice(0, minLength);
  }

  // 计算加权欧氏距离
  let sum = 0;
  let totalWeight = 0;

  for (let i = 0; i < embedding1.length; i++) {
    // 根据特征类型设置权重
    let weight = 1;
    
    // 归一化坐标: 权重1
    if (i < embedding1.length - 10) {
      weight = 1;
    }
    // 距离特征: 权重3(更重要)
    else if (i < embedding1.length - 4) {
      weight = 3;
    }
    // 几何特征: 权重5(最重要)
    else {
      weight = 5;
    }

    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff * weight;
    totalWeight += weight;
  }

  return Math.sqrt(sum / totalWeight);
}

/**
 * 优化版: 人脸匹配算法
 * 改进:
 * 1. 降低阈值,提高识别率
 * 2. 使用多级阈值策略
 * 3. 考虑数据库人员数量
 */
export function matchFace(
  faceEmbedding: number[],
  knownFaces: Array<{ id: number; name: string; embedding: number[] }>,
  baseThreshold: number = 0.35 // 降低基础阈值
): { id: number; name: string; similarity: number } | null {
  if (knownFaces.length === 0) {
    return null;
  }

  let bestMatch: { id: number; name: string; similarity: number; distance: number } | null = null;
  let secondBestDistance = Infinity;
  let minDistance = Infinity;

  // 计算所有人脸的距离
  for (const known of knownFaces) {
    try {
      const distance = calculateDistance(faceEmbedding, known.embedding);
      
      // 优化的相似度转换公式
      // 距离越小,相似度越高
      const similarity = Math.max(0, Math.min(100, (1 - distance / 2.5) * 100));

      if (distance < minDistance) {
        secondBestDistance = minDistance;
        minDistance = distance;
        bestMatch = {
          id: known.id,
          name: known.name,
          similarity: Math.round(similarity * 10) / 10, // 保留一位小数
          distance: distance,
        };
      } else if (distance < secondBestDistance) {
        secondBestDistance = distance;
      }
    } catch (error) {
      console.error(`Error comparing with ${known.name}:`, error);
    }
  }

  if (!bestMatch) {
    return null;
  }

  // 动态阈值策略
  let threshold = baseThreshold;
  
  // 如果只有一个人,降低阈值
  if (knownFaces.length === 1) {
    threshold = baseThreshold * 0.6; // 降低40%
  }
  // 如果最佳匹配明显优于次佳匹配,降低阈值
  else if (secondBestDistance - minDistance > 0.3) {
    threshold = baseThreshold * 0.8; // 降低20%
  }

  // 转换为相似度阈值
  const similarityThreshold = threshold * 100;

  console.log(`[Match] Best: ${bestMatch.name} (${bestMatch.similarity}%, dist=${bestMatch.distance.toFixed(4)}), Threshold: ${similarityThreshold.toFixed(1)}%`);

  if (bestMatch.similarity >= similarityThreshold) {
    console.log(`✓ Match found: ${bestMatch.name} (${bestMatch.similarity}%)`);
    return {
      id: bestMatch.id,
      name: bestMatch.name,
      similarity: bestMatch.similarity,
    };
  }

  console.log(`✗ No match: best similarity ${bestMatch.similarity}% < threshold ${similarityThreshold.toFixed(1)}%`);
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
      console.warn(`Multiple faces detected (${faces.length}), using the largest one`);
      // 选择最大的人脸
      faces.sort((a, b) => {
        const aSize = (Math.max(...a.keypoints.map(p => p.x)) - Math.min(...a.keypoints.map(p => p.x))) *
                      (Math.max(...a.keypoints.map(p => p.y)) - Math.min(...a.keypoints.map(p => p.y)));
        const bSize = (Math.max(...b.keypoints.map(p => p.x)) - Math.min(...b.keypoints.map(p => p.x))) *
                      (Math.max(...b.keypoints.map(p => p.y)) - Math.min(...b.keypoints.map(p => p.y)));
        return bSize - aSize;
      });
    }

    const embedding = extractFaceEmbedding(faces[0]);
    console.log(`✓ Face embedding extracted: ${embedding.length} features`);
    return embedding;
  } catch (error) {
    console.error("✗ Error extracting face from image:", error);
    return null;
  }
}

/**
 * 计算特征向量质量分数
 */
export function calculateEmbeddingQuality(embedding: number[]): number {
  if (!embedding || embedding.length === 0) {
    return 0;
  }

  let score = 100;

  // 检查是否有异常值
  const hasNaN = embedding.some(v => isNaN(v));
  const hasInfinity = embedding.some(v => !isFinite(v));
  
  if (hasNaN || hasInfinity) {
    score -= 50;
  }

  // 检查特征的方差(方差太小说明特征不明显)
  const mean = embedding.reduce((a, b) => a + b, 0) / embedding.length;
  const variance = embedding.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / embedding.length;
  
  if (variance < 0.01) {
    score -= 30;
  } else if (variance < 0.05) {
    score -= 15;
  }

  // 检查特征的范围
  const max = Math.max(...embedding);
  const min = Math.min(...embedding);
  const range = max - min;
  
  if (range < 0.5) {
    score -= 20;
  } else if (range < 1) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

