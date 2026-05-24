import { addClassname } from '../../../static/js/components/-NEW-/functions/dom.js';

// Wire Django flash messages (.alert.alert-dismissible .close) for both the
// legacy LegacyTopbarMount path and the modern AppLayout path. The messages
// markup is server-rendered via templates/messages.html inside root.html,
// so it appears on every page regardless of which shell mounts.
//
// 1s delay matches the prior behavior in LegacyTopbarMount: it gives the
// shell time to render before we query for close buttons.
export function wireAlertDismiss() {
	function onClickAlertClose() {
		const alertElem = this.parentNode;
		addClassname(alertElem, 'hiding');
		setTimeout(() => {
			if (alertElem && alertElem.parentNode) {
				alertElem.parentNode.removeChild(alertElem);
			}
		}, 400);
	}
	setTimeout(() => {
		document
			.querySelectorAll('.alert.alert-dismissible .close')
			.forEach((btn) => btn.addEventListener('click', onClickAlertClose));
	}, 1000);
}
