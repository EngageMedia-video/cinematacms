/**
 * Hot-toast behaviour for .auth-message-stack.auth-message-toast banners.
 *
 * - Re-parents each toast stack to <body> so position:fixed is relative to the
 *   viewport (inside the transformed .page-main wrapper it would be clipped).
 * - Auto-dismisses each banner after a delay, pausing on hover.
 * - Owns a single delegated close handler so the close button animates the exit
 *   instead of hard-removing the node. This replaces the per-banner inline
 *   onclick handlers that previously lived in the message templates.
 *
 * Moved out of an inline <script> (templates/account/snippets/auth_toast.html)
 * into the Vite pipeline so it is linted and shipped as one cached asset.
 */

const AUTO_DISMISS_MS = 3000;
const HOVER_RESUME_MS = 1500;
const EXIT_FALLBACK_MS = 280;

let delegatedBound = false;

function dismiss(banner) {
	clearTimeout(banner._dismissTimer);
	const stack = banner.closest('.auth-message-stack');
	const done = function () {
		if (!banner.isConnected) return;
		banner.remove();
		if (stack && !stack.querySelector('.auth-message-banner')) stack.remove();
	};
	banner.classList.add('is-leaving');
	banner.addEventListener('animationend', done, { once: true });
	setTimeout(done, EXIT_FALLBACK_MS);
}

function schedule(banner, delay) {
	clearTimeout(banner._dismissTimer);
	banner._dismissTimer = setTimeout(function () {
		dismiss(banner);
	}, delay);
}

function bindDelegatedClose() {
	if (delegatedBound) return;
	delegatedBound = true;
	document.addEventListener('click', function (event) {
		const button = event.target.closest('.auth-message-close');
		if (!button) return;
		const banner = button.closest('.auth-message-banner');
		// Only own dismissal for the toast variant; legacy alerts handle their own.
		if (!banner || !banner.closest('.auth-message-toast')) return;
		event.preventDefault();
		dismiss(banner);
	});
}

export function initToast() {
	bindDelegatedClose();
	document.querySelectorAll('.auth-message-toast').forEach(function (stack) {
		if (stack.parentElement !== document.body) {
			document.body.appendChild(stack);
		}
		stack.querySelectorAll('.auth-message-banner').forEach(function (banner) {
			if (banner.dataset.toastReady === 'true') return;
			banner.dataset.toastReady = 'true';
			schedule(banner, AUTO_DISMISS_MS);
			banner.addEventListener('mouseenter', function () {
				clearTimeout(banner._dismissTimer);
			});
			banner.addEventListener('mouseleave', function () {
				schedule(banner, HOVER_RESUME_MS);
			});
			// Pause on keyboard focus too, so a focused close button / link inside
			// the toast doesn't disappear mid-interaction.
			banner.addEventListener('focusin', function () {
				clearTimeout(banner._dismissTimer);
			});
			banner.addEventListener('focusout', function () {
				schedule(banner, HOVER_RESUME_MS);
			});
		});
	});
}
