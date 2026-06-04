/**
 * Applies friendly placeholders to the allauth form fields on auth pages.
 * allauth renders fields without placeholders, so they are mapped by name here.
 *
 * Moved out of an inline <script> (templates/account/auth_base.html) into the
 * auth Vite entry so the page carries no inline script. Localized strings come
 * from the #auth-i18n node the template renders with {% trans %}; the English
 * map below is only a fallback when that node is absent.
 */

const PLACEHOLDERS = {
	code: 'Code',
	email: 'Username or email',
	login: 'Username or email',
	location_country: 'Country/Region',
	name: 'Name',
	new_password1: 'Password',
	new_password2: 'Password',
	newpassword1: 'Password',
	newpassword2: 'Password',
	oldpassword: 'Current password',
	password: 'Password',
	password1: 'Password',
	password2: 'Password',
	username: 'Username',
};

export function initFieldPlaceholders() {
	const i18n = document.getElementById('auth-i18n');
	document.querySelectorAll('.auth-field input, .auth-field select').forEach(function (field) {
		const fallback = PLACEHOLDERS[field.name];
		if (!fallback) return;
		const localized = i18n && i18n.getAttribute('data-placeholder-' + field.name);
		field.setAttribute('placeholder', localized || fallback);
	});
}
