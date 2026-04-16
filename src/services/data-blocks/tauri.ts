import type { DataBlocksService } from './types'

function notImplemented(): never {
  throw new Error('Data blocks tauri service is not implemented yet')
}

export const dataBlocksTauriService: DataBlocksService = {
  async getLayout() {
    return notImplemented()
  },
  async saveLayout() {
    return notImplemented()
  },
  async addCard() {
    return notImplemented()
  },
  async deleteCard() {
    return notImplemented()
  },
  async getCardData() {
    return notImplemented()
  },
  async refreshCardData() {
    return notImplemented()
  },
}
