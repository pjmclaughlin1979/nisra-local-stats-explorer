// Simple line icons for the topic sections, as SVG markup both frameworks can inline.

const svg = (body) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  people: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><path d="M15 14.3c2.6-.4 4.8 1 5.4 4"/>'),
  health: svg('<path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z"/>'),
  work: svg('<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8.5 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v2"/><path d="M3 12.5h18"/>'),
  education: svg('<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.4 1.4 3.3 2 5.5 2s4.1-.6 5.5-2V11"/><path d="M21.5 9v5"/>'),
  environment: svg('<path d="M5 19c0-8 5-13 14-14-.5 9-5.5 14-13 14z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>'),
  crime: svg('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>'),
  business: svg('<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M21 20H3"/>'),
};
