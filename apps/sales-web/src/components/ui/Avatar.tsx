export function Avatar({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-16 w-16 text-lg' }
  return <div aria-hidden="true" className={`grid shrink-0 place-items-center rounded-2xl font-extrabold text-white shadow-sm ${sizes[size]}`} style={{ backgroundColor: color }}>{initials}</div>
}
