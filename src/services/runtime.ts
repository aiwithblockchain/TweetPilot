export type ServiceMode = 'mock' | 'tauri'

const requestedMode = import.meta.env.VITE_SERVICE_MODE

export const serviceMode: ServiceMode = requestedMode === 'tauri' ? 'tauri' : 'mock'
