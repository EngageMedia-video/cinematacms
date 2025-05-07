/**
 * VideoPlayerLoader - Lazy loads video.js library to improve performance
 */

export default class VideoPlayerLoader {
  /**
   * Dynamically load the video.js library
   * @returns {Promise} Promise resolving when video.js is loaded
   */
  static loadVideoJs() {
    // Skip if already loaded
    if (window.videojs) {
      return Promise.resolve(window.videojs);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/static/lib/video-js/7.18.1/video.min.js';
      script.async = true;
      script.onload = () => {
        if (window.videojs) {
          resolve(window.videojs);
        } else {
          reject(new Error('Failed to load video.js'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load video.js'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize a video player on an element
   * @param {HTMLElement|string} element - The video element or its ID
   * @param {Object} options - Video.js options
   * @returns {Promise} Promise resolving to the video.js player instance
   */
  static async initPlayer(element, options = {}) {
    try {
      const videojs = await this.loadVideoJs();
      return videojs(element, options);
    } catch (error) {
      console.error('Error initializing video player:', error);
      throw error;
    }
  }
}
