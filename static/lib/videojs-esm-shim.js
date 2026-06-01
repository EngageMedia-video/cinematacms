// ESM shim for video.js. Most pages still load the UMD global in root.html.
// Modern pages can skip that eager script; this shim loads it only when a
// lazy player chunk imports "video.js".
const videoJsUrl = new URL('./video-js/7.20.2/video.min.js', import.meta.url).toString();

function loadVideoJs() {
	if (window.videojs) {
		return Promise.resolve(window.videojs);
	}

	if (window.__cinemataVideoJsPromise) {
		return window.__cinemataVideoJsPromise;
	}

	window.__cinemataVideoJsPromise = new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = videoJsUrl;
		script.async = true;
		const fail = (message) => {
			window.__cinemataVideoJsPromise = undefined;
			script.remove();
			reject(new Error(message));
		};
		script.onload = () => {
			if (window.videojs) {
				resolve(window.videojs);
				return;
			}
			fail(`Video.js loaded from ${videoJsUrl} but did not initialize window.videojs`);
		};
		script.onerror = () => fail(`Failed to load Video.js from ${videoJsUrl}`);
		document.head.appendChild(script);
	});

	return window.__cinemataVideoJsPromise;
}

const videojs = await loadVideoJs();

export default videojs;
