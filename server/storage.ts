// 本地文件存储实现
// 不再依赖Forge API,使用本地文件系统

import * as fs from "fs";
import * as path from "path";
import { ENV } from './_core/env';

// 本地存储目录
const STORAGE_DIR = path.join(process.cwd(), "uploads");

// 确保存储目录存在
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

/**
 * 生成唯一的文件名
 */
function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  return `${baseName}_${timestamp}_${random}${ext}`;
}

/**
 * 获取文件的公网URL
 */
function getPublicUrl(fileName: string): string {
  // 如果有配置的公网地址,使用配置的地址
  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${baseUrl}/uploads/${fileName}`;
}

/**
 * 上传文件到本地存储
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  try {
    // 生成唯一文件名
    const fileName = generateUniqueFileName(relKey);
    const filePath = path.join(STORAGE_DIR, fileName);

    // 将数据转换为Buffer
    let buffer: Buffer;
    if (typeof data === "string") {
      // 如果是base64字符串,去除data URL前缀
      const base64Data = data.includes("base64,") 
        ? data.split("base64,")[1] 
        : data;
      buffer = Buffer.from(base64Data, "base64");
    } else if (data instanceof Uint8Array) {
      buffer = Buffer.from(data);
    } else {
      buffer = data;
    }

    // 写入文件
    await fs.promises.writeFile(filePath, buffer);

    // 返回文件信息
    const url = getPublicUrl(fileName);
    console.log(`✓ File uploaded: ${fileName} (${buffer.length} bytes)`);

    return {
      key: fileName,
      url: url,
    };
  } catch (error) {
    console.error("✗ Storage upload failed:", error);
    throw new Error(`Storage upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取文件的下载URL
 */
export async function storageGet(
  relKey: string,
  _expiresIn = 300
): Promise<{ key: string; url: string }> {
  const filePath = path.join(STORAGE_DIR, relKey);

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${relKey}`);
  }

  const url = getPublicUrl(relKey);

  return {
    key: relKey,
    url: url,
  };
}

/**
 * 删除文件
 */
export async function storageDelete(relKey: string): Promise<void> {
  const filePath = path.join(STORAGE_DIR, relKey);

  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
    console.log(`✓ File deleted: ${relKey}`);
  }
}

/**
 * 列出所有文件
 */
export async function storageList(): Promise<string[]> {
  const files = await fs.promises.readdir(STORAGE_DIR);
  return files;
}

