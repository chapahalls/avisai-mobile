import { create } from 'zustand';

const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin';
const VAD_URL =
  'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin';
const MODEL_SHA1 = '55356645c2b361a969dfd0ef2c5a50d530afd8d5';
const MODEL_NAME = 'ggml-small.bin';
const VAD_NAME = 'ggml-silero-v6.2.0.bin';

export type OfflineModelStatus = 'checking' | 'missing' | 'downloading' | 'ready' | 'error';

interface OfflineModelStore {
  status: OfflineModelStatus;
  progress: number;
  error: string | null;
}

interface NativeFileSystem {
  DocumentDirectoryPath: string;
  exists(path: string): Promise<boolean>;
  unlink(path: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  stat(path: string): Promise<{ size: number }>;
  hash(path: string, algorithm: string): Promise<string>;
  downloadFile(options: {
    fromUrl: string;
    toFile: string;
    progressInterval?: number;
    progress?: (event: { bytesWritten: number; contentLength: number }) => void;
  }): { jobId: number; promise: Promise<{ statusCode: number; bytesWritten: number }> };
  stopDownload(jobId: number): void;
}

const getFileSystem = (): NativeFileSystem => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-fs') as NativeFileSystem;
};

export const useOfflineWhisperModel = create<OfflineModelStore>(() => ({
  status: 'checking',
  progress: 0,
  error: null,
}));

export function getOfflineWhisperModelPaths() {
  const fs = getFileSystem();
  return {
    modelPath: `${fs.DocumentDirectoryPath}/${MODEL_NAME}`,
    vadPath: `${fs.DocumentDirectoryPath}/${VAD_NAME}`,
  };
}

export async function checkOfflineWhisperModel(): Promise<boolean> {
  if (activeDownload) return useOfflineWhisperModel.getState().status === 'ready';
  try {
    const fs = getFileSystem();
    const { modelPath, vadPath } = getOfflineWhisperModelPaths();
    const ready = (await fs.exists(modelPath)) && (await fs.exists(vadPath));
    useOfflineWhisperModel.setState({ status: ready ? 'ready' : 'missing', progress: ready ? 100 : 0 });
    return ready;
  } catch {
    useOfflineWhisperModel.setState({ status: 'missing', progress: 0 });
    return false;
  }
}

let activeDownload: Promise<void> | null = null;
let activeJobId: number | null = null;

async function downloadFile(
  fs: NativeFileSystem,
  url: string,
  destination: string,
  onProgress?: (value: number) => void,
) {
  const tempPath = `${destination}.download`;
  if (await fs.exists(tempPath)) await fs.unlink(tempPath);
  const task = fs.downloadFile({
    fromUrl: url,
    toFile: tempPath,
    progressInterval: 500,
    progress: onProgress
      ? ({ bytesWritten, contentLength }) => {
          if (contentLength > 0) onProgress(Math.min(99, Math.floor((bytesWritten / contentLength) * 100)));
        }
      : undefined,
  });
  activeJobId = task.jobId;
  const result = await task.promise;
  activeJobId = null;
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`Download failed (${result.statusCode})`);
  }
  const stat = await fs.stat(tempPath);
  if (stat.size < 1024 * 1024) throw new Error('Downloaded model is incomplete');
  if (destination.endsWith(MODEL_NAME)) {
    const sha1 = await fs.hash(tempPath, 'sha1');
    if (sha1.toLowerCase() !== MODEL_SHA1) throw new Error('Whisper model checksum mismatch');
  }
  if (await fs.exists(destination)) await fs.unlink(destination);
  await fs.moveFile(tempPath, destination);
}

/** Baixa o Whisper small e o modelo leve de detecção de fala para uso offline. */
export function downloadOfflineWhisperModel(): Promise<void> {
  if (activeDownload) return activeDownload;
  activeDownload = (async () => {
    useOfflineWhisperModel.setState({ status: 'downloading', progress: 0, error: null });
    try {
      const fs = getFileSystem();
      const { modelPath, vadPath } = getOfflineWhisperModelPaths();
      if (!(await fs.exists(vadPath))) await downloadFile(fs, VAD_URL, vadPath);
      if (!(await fs.exists(modelPath))) {
        await downloadFile(fs, MODEL_URL, modelPath, (progress) =>
          useOfflineWhisperModel.setState({ progress }),
        );
      }
      useOfflineWhisperModel.setState({ status: 'ready', progress: 100, error: null });
    } catch (error) {
      useOfflineWhisperModel.setState({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      activeDownload = null;
      activeJobId = null;
    }
  })();
  return activeDownload;
}

export function cancelOfflineWhisperDownload() {
  if (activeJobId !== null) getFileSystem().stopDownload(activeJobId);
}
