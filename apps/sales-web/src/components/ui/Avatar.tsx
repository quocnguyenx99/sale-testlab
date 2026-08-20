export function Avatar({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs rounded-lg',
    md: 'h-11 w-11 text-sm rounded-xl',
    lg: 'h-14 w-14 text-base rounded-2xl',
  }
  return (
    <div
      aria-hidden="true"
      className={`grid shrink-0 place-items-center font-bold text-white shadow-subtle ${sizes[size]}`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}
