import { cn } from '@/lib/utils'

/** Initials in a coloured circle. */
export function UserAvatar({ user, size = 'sm' }) {
  const classes = size === 'lg' ? 'size-20 text-xl' : 'size-9 text-xs'
  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-secondary font-semibold text-white ring-2 ring-card', classes)}>
      {initials}
    </span>
  )
}
