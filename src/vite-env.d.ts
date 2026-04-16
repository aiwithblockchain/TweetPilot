/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVICE_MODE?: 'mock' | 'tauri'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {
  const content: Record<string, string>
  export default content
}

declare module '*.scss' {
  const content: Record<string, string>
  export default content
}

declare module '*.sass' {
  const content: Record<string, string>
  export default content
}
