import { invoke } from '@tauri-apps/api/core'

export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }
}
