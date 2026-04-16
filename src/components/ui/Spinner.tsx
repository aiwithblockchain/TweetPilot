export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: string
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
}

export default function Spinner({ size = 'md', color, className = '' }: SpinnerProps) {
  const colorClass = color || 'border-[var(--color-border)] border-t-[#6D5BF6]'

  return (
    <div
      className={`${sizeClasses[size]} ${colorClass} rounded-full animate-spin ${className}`}
    />
  )
}
