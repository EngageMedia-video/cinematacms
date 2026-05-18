import React, { useEffect } from 'react';

// Legacy pages don't load AppLayout, so these globals must reload here.
import '../../../static/css/styles.scss';
import '../../../static/js/components/styles/PageMain.scss';

import PageStore from '../../../static/js/pages/_PageStore.js';
import { addClassname } from '../../../static/js/components/-NEW-/functions/dom.js';

import { TopMessageHost } from '../components/TopMessageHost';
import { Topbar } from './Topbar';

// Legacy PageHeader used to attach a dismiss handler to Django flash alerts
// and inject the configured pre-upload message into .media-uploader-wrap on
// the add-media page. Both are server-rendered chrome that this React tree
// doesn't own, so we replay the same DOM hookups here.
function wireAlertDismiss() {
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

function injectPreUploadMessage() {
	const uploaderWrap = document.querySelector('.media-uploader-wrap');
	if (!uploaderWrap) return;
	const belowUploadArea = PageStore.get('config-contents')?.uploader?.belowUploadArea;
	if (!belowUploadArea) return;
	// Update in place if a previous mount already injected the element
	// (HMR/fast-refresh would otherwise stack duplicates).
	const existing = uploaderWrap.querySelector('.pre-upload-msg');
	if (existing) {
		existing.innerHTML = belowUploadArea;
		return;
	}
	const preUploadMsgEl = document.createElement('div');
	preUploadMsgEl.setAttribute('class', 'pre-upload-msg');
	preUploadMsgEl.innerHTML = belowUploadArea;
	uploaderWrap.appendChild(preUploadMsgEl);
}

export function LegacyTopbarMount() {
	useEffect(() => {
		wireAlertDismiss();
		const currentPage = PageStore.get('current-page');
		if (currentPage === undefined || currentPage === 'add-media') {
			injectPreUploadMessage();
		}
	}, []);

	return (
		<>
			<TopMessageHost />
			<Topbar />
		</>
	);
}
