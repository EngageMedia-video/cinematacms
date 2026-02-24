// ESM shim for video.js — re-exports the UMD global loaded by <script> tag.
// This file is referenced by the import map in root.html so that Vite's
// external `import videojs from 'video.js'` resolves to the already-loaded global.
export default window.videojs;
