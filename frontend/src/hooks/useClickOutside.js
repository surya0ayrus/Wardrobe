import { useEffect } from 'react'

/** Calls onOutside when the user clicks / taps outside the element in `ref` (for menus). */
export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined
    const handle = (event) => {
      if (!ref.current?.contains(event.target)) onOutside()
    }
    const escape = (event) => event.key === 'Escape' && onOutside()
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', escape)
    }
  }, [ref, onOutside, active])
}
