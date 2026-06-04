/**
 * Sign-out confirmation modal behaviour.
 *
 * The modal markup is injected on every authenticated page (base.html /
 * base_modern.html). Any link pointing at the logout URL is intercepted and
 * opens the modal instead of navigating, which then POSTs to log out. Includes
 * a focus trap and Escape-to-close.
 *
 * Moved out of an inline <script> (templates/account/snippets/logout_modal.html)
 * into the base entry so it is linted and shipped in the cached bundle rather
 * than re-parsed inline on every page.
 */

export function initLogoutModal() {
	const modal = document.querySelector('[data-signout-modal]');
	if (!modal || modal.dataset.signoutReady === 'true') return;
	modal.dataset.signoutReady = 'true';

	const card = modal.querySelector('[role="dialog"]');
	const form = modal.querySelector('form');
	if (!form) return;
	const logoutPath = new URL(form.getAttribute('action'), window.location.origin).pathname;
	let lastFocus = null;

	function isSignOutTrigger(target) {
		const link = target.closest ? target.closest('a[href]') : null;
		if (!link) return false;
		try {
			return new URL(link.href, window.location.origin).pathname === logoutPath;
		} catch (e) {
			return false;
		}
	}

	function focusables() {
		return Array.prototype.slice
			.call(modal.querySelectorAll('a[href], button:not([disabled])'))
			.filter(function (el) { return el.offsetParent !== null; });
	}

	function open() {
		if (!modal.hidden) return;
		lastFocus = document.activeElement;
		modal.hidden = false;
		document.body.style.overflow = 'hidden';
		(card || modal).focus();
	}

	function close() {
		if (modal.hidden) return;
		modal.hidden = true;
		document.body.style.overflow = '';
		if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
	}

	document.addEventListener('click', function (event) {
		if (isSignOutTrigger(event.target)) {
			event.preventDefault();
			open();
			return;
		}
		if (event.target.closest('[data-signout-cancel]')) {
			event.preventDefault();
			close();
			return;
		}
		if (event.target === modal) close();
	});

	document.addEventListener('keydown', function (event) {
		if (modal.hidden) return;
		if (event.key === 'Escape') {
			close();
			return;
		}
		if (event.key === 'Tab') {
			const items = focusables();
			if (!items.length) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	});
}
