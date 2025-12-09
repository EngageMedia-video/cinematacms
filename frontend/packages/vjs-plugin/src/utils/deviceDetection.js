/**
 * Device detection utilities for cross-platform video player behavior.
 */

/**
 * Detects if the current device is running iOS (iPhone, iPad, iPod).
 *
 * Note: This includes iPadOS 13+ detection which reports as 'MacIntel' with touch support.
 * navigator.platform is deprecated but still necessary for accurate iPadOS detection.
 *
 * @returns {boolean} True if the device is iOS, false otherwise (including SSR/non-browser environments)
 */
export function isIOSDevice() {
    // Guard against non-browser environments (SSR, Web Workers, tests)
    if (typeof navigator === 'undefined') {
        return false;
    }

    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    // Standard iOS detection
    const isStandardIOS = /iPad|iPhone|iPod/.test(userAgent);

    // iPadOS 13+ reports as 'MacIntel' but has touch support
    // See: https://github.com/videojs/video.js/issues/8061
    const isIPadOS = platform === 'MacIntel' && maxTouchPoints > 1;

    return isStandardIOS || isIPadOS;
}
