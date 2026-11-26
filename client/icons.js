// Original spot illustrations drawn on a shared 36-unit grid.
const icons={
  customize:'<path fill="#465c71" d="m7 7 19-2 4 20-22 2z"/><path fill="#86dbbd" d="m10 9 13-1 3 11-14 1z"/><path fill="#a5b9c5" d="m8 22 22-2 5 7-24 5-7-5z"/><path d="m13 25 15-3m-11 6 8-1"/>',
  report:'<path fill="#f5ba60" d="M4 15 16 13l13-8 3 23-15-6-12 1z"/><path fill="#e17a58" d="m12 22 6-1 1 10-5 2zM23 10l5-4 4 22-6-3z"/><path d="M4 8 8 5M4 29l4 2m23-19 3-3"/>',
  use:'<path fill="#dde1e2" d="M4 6h28L18 31z"/><path fill="#a2d6c9" d="m10 10 8 15 8-15z"/><path fill="none" d="M18 10v8m-4-4 4 4 4-4"/>',
  kill:'<path fill="#cb5354" d="m3 17 6-4 1-7 7 4 7-6 2 8 7 4-4 6 2 8-9-1-5 5-4-6-8 2 2-8z"/><path fill="#f4ded5" d="m10 19 6 7 11-14-4-2-7 10-3-4z"/>',
  sabotage:'<path fill="#bc494e" d="m7 5 21 1 6 10-4 13-12 4L5 27 2 16z"/><path fill="#f2b682" d="m20 8-10 13h7l-1 8 10-13h-7z"/>',
  vent:'<path fill="#a6b4bd" d="M8 8h20l6 11-5 9H7l-5-9z"/><path fill="#415363" d="m7 18 22 0-3 7H10z"/><path d="M7 13h22m-18 8h14"/>',
  admin:'<rect fill="#496d65" x="3" y="5" width="30" height="26" rx="4"/><path fill="#a3dcb1" d="M7 12h8v5h7v-5h7v10h-7v5h-7v-5H7z"/>',
  security:'<rect fill="#4d7575" x="3" y="6" width="30" height="24" rx="4"/><path fill="#a2d4bc" d="M7 16q11-12 22 0-11 13-22 0Z"/><circle fill="#477b94" cx="18" cy="16" r="4"/>',
  vitals:'<rect fill="#4e6572" x="3" y="6" width="30" height="24" rx="4"/><path fill="none" stroke="#9dead0" d="M6 18h6l3-5 4 12 4-11 4 4h3"/>',
  settings:'<circle fill="#687b91" cx="18" cy="18" r="15"/><path fill="#d1e2e2" d="m15 8 5 0 1 4 3-1 3 4-2 3 2 3-3 4-4-1-1 4h-4l-1-4-4 1-2-4 2-3-2-3 3-4 3 1z"/><circle fill="#4d687a" cx="18" cy="18" r="3"/>',
  map:'<path fill="#9fc9d6" d="m3 9 10-5 11 5 9-4v23l-9 4-11-5-10 5z"/><path fill="none" d="M13 4v23m11-18v23M7 20l6-6 11 6 5-5"/>',
  start:'<path fill="#76c8ad" d="m3 6 30 12L3 30l5-12z"/><path fill="#e2fff1" d="m14 11 12 7-12 7 3-7z"/>',
  again:'<path fill="#b5d6d0" d="m3 15 12-10v7h6q12 0 12 11 0 7-7 9l-4-5q6-1 6-5 0-4-7-4h-6v7z"/>',
  quit:'<path fill="#d49e9b" d="m7 5 11 10L29 5l5 5-11 9 10 10-5 5-10-10L7 34l-5-5 11-10L2 10z"/>',
  lights:'<path fill="#f2cd7a" d="m19 4-11 17h8l-1 11L28 14h-9z"/>',
  comms:'<path fill="none" stroke="#f1c9b0" stroke-width="4" d="M5 11q13-11 26 0M9 17q9-8 18 0m-14 6q5-4 10 0"/><circle fill="#f1c9b0" cx="18" cy="28" r="3"/>',
  oxygen:'<circle fill="#9dbcc8" cx="18" cy="18" r="15"/><path fill="none" d="M8 17q0-6 5-6t5 6q0 5-5 5t-5-5m12 3q0-4 3-4 7 0-2 8h6"/>',
  reactor:'<path fill="#e2b66c" d="m18 3 15 27H3z"/><circle fill="#923e4d" cx="18" cy="19" r="3"/><path d="m17 15-2-5m7 11 5 3m-12-2-5 2"/>',
  doors:'<path fill="#b5a9ab" d="M5 4h26v28H5z"/><path d="M18 4v28M8 9h7m6 18h7"/>'
};
export function actionIcon(name){
  return `<svg class="action-art" viewBox="0 0 36 36" stroke="#1d2735" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
