const headingModeCursorSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="#020617" flood-opacity="0.95" />
    </filter>
  </defs>
  <g filter="url(#shadow)" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="16" r="7" stroke="white" stroke-width="2.4" opacity="0.95" />
    <circle cx="16" cy="16" r="4.25" stroke="#22d3ee" stroke-width="1.6" />
    <path d="M16 3.5V9.5M16 22.5V28.5M3.5 16H9.5M22.5 16H28.5" stroke="white" stroke-width="2.4" />
    <path d="M16 5V9M16 23V27M5 16H9M23 16H27" stroke="#22d3ee" stroke-width="1.6" />
  </g>
</svg>`;

export const HEADING_MODE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  headingModeCursorSvg,
)}") 16 16, crosshair`;
