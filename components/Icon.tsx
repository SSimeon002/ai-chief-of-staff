// Lightweight inline SVG icons used across the UI.
// Sized via CSS — each icon inherits currentColor.

export const Icon = {
  email: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 5 L8 9 L13.5 5" />
    </svg>
  ),
  slack: () => (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="6.5" width="3" height="3" rx="1.5" />
      <rect x="6.5" y="2" width="3" height="3" rx="1.5" />
      <rect x="11" y="6.5" width="3" height="3" rx="1.5" />
      <rect x="6.5" y="11" width="3" height="3" rx="1.5" />
      <rect x="6.5" y="6.5" width="3" height="3" rx="0.5" opacity="0.4" />
    </svg>
  ),
  whatsapp: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.5 A5.5 5.5 0 1 1 2.5 8 A5.5 5.5 0 0 1 5 3.4 L3 13.5 L7.2 12.4 A5.5 5.5 0 0 1 8 2.5 Z" />
    </svg>
  ),
  alert: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2 L14 13 H2 Z" />
      <path d="M8 6.5 V9.5" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  ),
  shield: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2 L13 4 V8 C13 11 11 13 8 14 C5 13 3 11 3 8 V4 Z" />
    </svg>
  ),
  clock: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5 V8 L10.5 9.5" />
    </svg>
  ),
  sun: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6M12.6 12.6L11.5 11.5M4.5 4.5L3.4 3.4" />
    </svg>
  ),
  moon: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 9.5 A5.5 5.5 0 0 1 6.5 3 A5.5 5.5 0 1 0 13 9.5 Z" />
    </svg>
  ),
  sparkle: () => (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5 L9 5.5 L13 6.5 L9 7.5 L8 11.5 L7 7.5 L3 6.5 L7 5.5 Z" />
      <path
        d="M12 10 L12.5 12 L14.5 12.5 L12.5 13 L12 15 L11.5 13 L9.5 12.5 L11.5 12 Z"
        opacity="0.5"
      />
    </svg>
  ),
  check: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8 L7 12 L13 4" />
    </svg>
  ),
  chevron: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 6 L8 9 L11 6" />
    </svg>
  ),
  upload: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 11 V2 M4 6 L8 2 L12 6" />
      <path d="M2.5 11 V13 A1 1 0 0 0 3.5 14 H12.5 A1 1 0 0 0 13.5 13 V11" />
    </svg>
  ),
  filter: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4 H14 L10 9 V13 L6 13 V9 Z" />
    </svg>
  ),
  gear: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6M12.6 12.6L11.5 11.5M4.5 4.5L3.4 3.4" />
    </svg>
  ),
  copy: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="5" width="8" height="9" rx="1.5" />
      <path d="M3.5 11 V3.5 A1.5 1.5 0 0 1 5 2 H10.5" />
    </svg>
  ),
  desktop: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2.5" width="12" height="8" rx="1" />
      <path d="M5 13 H11 M8 10.5 V13" />
    </svg>
  ),
  mobile: () => (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="1.5" width="7" height="13" rx="1.4" />
      <path d="M7 12.5 H9" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;
