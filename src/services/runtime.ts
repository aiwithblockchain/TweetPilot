export type ServiceMode = 'mock' | 'tauri'

// Always use tauri mode when running in the app
export const serviceMode: ServiceMode = 'tauri'

console.log('[Runtime] Service mode: tauri (forced)')
