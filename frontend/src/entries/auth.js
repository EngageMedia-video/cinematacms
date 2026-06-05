import '../features/auth/auth-enhancements.css';
import { initFieldPlaceholders } from '../features/auth/fieldPlaceholders.js';
import { initCountryCombobox } from '../features/auth/countryCombobox.js';
import { initToast } from '../features/auth/toast.js';

function onReady(fn) {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', fn);
	} else {
		fn();
	}
}

onReady(function () {
	initFieldPlaceholders();
	initCountryCombobox();
	initToast();
});
