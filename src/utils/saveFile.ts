import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface SaveResult {
  savedPath: string;
  filename: string;
}

export async function saveVideoBlob(blob: Blob, filename: string): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    const reader = new FileReader();
    const data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const path = `GIF转视频/${filename}`;
    await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Documents,
      recursive: true,
    });

    return { savedPath: path, filename };
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { savedPath: '', filename };
  }
}
