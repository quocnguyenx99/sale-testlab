import { useEffect, useRef, type RefObject } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
): RefObject<T> {
  const containerRef = useRef<T>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusableElements = () => Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')

    const initialFocus = container.querySelector<HTMLElement>('[data-autofocus]')
      ?? focusableElements()[0]
      ?? container
    window.requestAnimationFrame(() => initialFocus.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const elements = focusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => previousFocus?.focus())
    }
  }, [active])

  return containerRef
}
