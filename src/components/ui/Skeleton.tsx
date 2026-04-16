export interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle'
  width?: string | number
  height?: string | number
  className?: string
}

export default function Skeleton({
  variant = 'rect',
  width,
  height,
  className = '',
}: SkeletonProps) {
  const baseClass = 'bg-[var(--color-surface)] animate-pulse'

  const variantClass = {
    text: 'rounded h-4',
    rect: 'rounded',
    circle: 'rounded-full',
  }[variant]

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return <div className={`${baseClass} ${variantClass} ${className}`} style={style} />
}
