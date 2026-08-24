interface BrandMarkProps {
  className?: string
}

/**
 * TestLab mark: a conversation card with an upward practice/progress signal.
 * It remains legible in the 16px favicon and the compact application rail.
 */
export function BrandMark({ className = 'h-9 w-9' }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="14" fill="#0068FF" />
      <path
        d="M13.25 13.5C13.25 11.9812 14.4812 10.75 16 10.75H32C33.5188 10.75 34.75 11.9812 34.75 13.5V26.25C34.75 27.7688 33.5188 29 32 29H23.25L17.5 33.25V29H16C14.4812 29 13.25 27.7688 13.25 26.25V13.5Z"
        fill="white"
      />
      <path d="M18 24.5L21.5 21L24.25 23.25L29.75 17.75" stroke="#0068FF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      <path d="M26.5 17.75H29.75V21" stroke="#0068FF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  )
}
