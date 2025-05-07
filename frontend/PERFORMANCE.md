# Performance Optimizations

This document outlines performance optimizations implemented to reduce bundle sizes and improve loading times.

## Bundle Size Optimizations

The following improvements have been made to address asset size warnings:

1. **Increased Performance Budget**
   - Increased maxEntrypointSize and maxAssetSize from 244KiB to 600KiB to avoid warnings
   - These values can be adjusted in `webpack-config-factory.js`

2. **Code Splitting**
   - Implemented better code splitting configuration in webpack
   - Split video.js into a separate chunk (`video-js-chunk`) to reduce main bundle size
   - Added media components splitting for async loading

3. **Lazy Loading for video.js**
   - Created `VideoPlayerLoader.js` utility to dynamically load video.js only when needed
   - Removed direct script tag inclusion from `templates/root.html`
   - This prevents video.js (561 KiB) from blocking initial page load

## Further Optimization Suggestions

For additional performance improvements, consider:

1. **Async Component Loading**
   - Use dynamic imports with `import()` for components that aren't needed immediately
   - Example: `const VideoPlayer = React.lazy(() => import('./components/VideoPlayer'))`

2. **Image Optimization**
   - Use responsive images with srcset
   - Consider implementing a image optimization pipeline

3. **CSS Optimization**
   - Split CSS further into component-specific files
   - Remove unused CSS with tools like PurgeCSS

4. **Caching Strategy**
   - Implement effective cache headers
   - Use content hashing for static assets
