import { OFFLINE_VOICE } from '../lib/config';
import { bytesToBase64 } from '../lib/base64';

/**
 * Áudios gravados sem sinal, esperando a rede. Ficam nos documentos do app (não vão para a
 * galeria nem para outros apps) e são apagados assim que o servidor confirma o recebimento.
 */
interface NativeFileSystem {
  DocumentDirectoryPath: string;
  mkdir(path: string): Promise<void>;
  writeFile(path: string, contents: string, encoding: 'base64'): Promise<void>;
  unlink(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

function fs(): NativeFileSystem | null {
  if (process.env.VITEST) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-fs') as NativeFileSystem;
  } catch {
    return null;
  }
}

export async function saveVoiceNote(id: string, wav: Uint8Array): Promise<string> {
  const native = fs();
  if (!native) throw new Error('Sem acesso a arquivos neste ambiente.');
  const dir = `${native.DocumentDirectoryPath}/${OFFLINE_VOICE.folder}`;
  await native.mkdir(dir);
  const path = `${dir}/${id}.wav`;
  await native.writeFile(path, bytesToBase64(wav), 'base64');
  return path;
}

export async function deleteVoiceNote(path: string): Promise<void> {
  const native = fs();
  if (!native || !path) return;
  try {
    if (await native.exists(path)) await native.unlink(path);
  } catch {
    // Arquivo já removido: nada a fazer.
  }
}
