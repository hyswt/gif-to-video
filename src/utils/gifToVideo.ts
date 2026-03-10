import { FFmpeg } from '@ffmpeg/ffmpeg';
import { Capacitor } from '@capacitor/core';

let ffmpeg: FFmpeg | null = null;

const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
];

function getLocalBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/ffmpeg`;
  }
  return '';
}

export async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });
  }

  const localBase = getLocalBaseUrl();
  const sources: string[] = [];
  if (Capacitor.isNativePlatform()) {
    sources.push(...CDN_SOURCES);
    if (localBase) sources.push(localBase);
  } else {
    if (localBase) sources.push(localBase);
    sources.push(...CDN_SOURCES);
  }

  let lastError: Error | null = null;
  for (const baseURL of sources) {
    try {
      const { toBlobURL } = await import('@ffmpeg/util');
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error('FFmpeg 加载失败');
}

export interface ConvertOptions {
  gifFile: File;
  frameRate: number;
  onProgress?: (progress: number) => void;
}

async function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result));
      } else {
        reject(new Error('无法读取文件'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败，请重试'));
    reader.readAsArrayBuffer(file);
  });
}

export async function convertGifToVideo({
  gifFile,
  frameRate,
  onProgress,
}: ConvertOptions): Promise<Blob> {
  const ffmpegInstance = await loadFFmpeg(onProgress);

  const timestamp = Date.now();
  const inputName = `input_${timestamp}.gif`;
  const outputName = `output_${timestamp}.mp4`;

  const fileData = await readFileAsUint8Array(gifFile);
  await ffmpegInstance.writeFile(inputName, fileData);

  await ffmpegInstance.exec([
    '-i', inputName,
    '-vf', `fps=${frameRate},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-movflags', 'faststart',
    '-pix_fmt', 'yuv420p',
    outputName,
  ]);

  const data = await ffmpegInstance.readFile(outputName);
  await ffmpegInstance.deleteFile(inputName);
  await ffmpegInstance.deleteFile(outputName);

  let bytes: Uint8Array;
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (typeof data === 'string') {
    const binary = atob(data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } else {
    bytes = new Uint8Array(data as unknown as ArrayBuffer);
  }
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);

  ffmpegInstance.terminate();
  ffmpeg = null;

  return new Blob([copy], { type: 'video/mp4' });
}
