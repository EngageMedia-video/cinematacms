/**
 * Progressive enhancement for the Country/Region field on the signup page.
 *
 * The real select[name="location_country"] stays in the DOM (hidden) so the
 * form still submits and works with JS disabled; this layers a searchable,
 * keyboard-navigable combobox on top that matches the auth field aesthetic.
 *
 * Moved out of an inline <script> (templates/account/snippets/auth_country_select.html)
 * into the Vite pipeline so it is linted, tested-friendly, and shipped as a
 * single cached, minified asset.
 */

// Tailwind class strings are kept as literals so the v4 source scanner picks them up.
const CLASS = {
	wrapper: 'auth-country relative',
	row: 'flex items-center gap-2',
	input: 'flex-1',
	chevron: 'pointer-events-none flex shrink-0 text-text-muted transition-transform duration-200 ease-out',
	chevronOpen: 'rotate-180',
	listbox:
		'absolute left-0 top-full z-20 m-0 mt-2 max-h-64 w-full list-none overflow-auto rounded-lg border border-border-default bg-bg-surface-raised py-1 ps-0 shadow-lg transition duration-150 ease-out [scrollbar-width:thin] [scrollbar-color:var(--border-default)_transparent] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-border-default [&::-webkit-scrollbar-thumb]:bg-clip-content',
	listClosed: 'pointer-events-none invisible -translate-y-1 opacity-0',
	listOpen: 'pointer-events-auto visible translate-y-0 opacity-100',
	option: 'flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm leading-5 text-text-strong hover:bg-bg-surface-hover',
	optionActive: 'bg-bg-surface-hover ring-2 ring-inset ring-ring-focus',
	check: 'size-4 shrink-0 text-text-link',
	empty: 'px-4 py-3 text-center text-sm leading-5 text-text-muted',
};

const CHEVRON_SVG =
	'<svg viewBox="0 0 256 256" class="size-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/></svg>';
const CHECK_SVG =
	'<svg viewBox="0 0 256 256" class="' +
	CLASS.check +
	'" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>';

// Localized strings come from the #auth-i18n node the template renders with
// {% trans %}; the English literals passed as fallback are used if it's absent.
function authI18n(attr, fallback) {
	const node = document.getElementById('auth-i18n');
	return (node && node.getAttribute(attr)) || fallback;
}

function setClass(el, value) {
	el.className = value;
}
function addClass(el, value) {
	value.split(' ').forEach(function (c) {
		if (c) el.classList.add(c);
	});
}
function removeClass(el, value) {
	value.split(' ').forEach(function (c) {
		if (c) el.classList.remove(c);
	});
}

function enhance(select) {
	if (!select || select.dataset.comboboxReady === 'true') return;
	select.dataset.comboboxReady = 'true';

	const field = select.closest('.auth-field');
	if (!field) return;
	const label = field.querySelector('label');
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Build the option model from the native select; the empty placeholder is "no selection".
	const options = Array.prototype.slice
		.call(select.options)
		.filter(function (opt) {
			return opt.value !== '';
		})
		.map(function (opt) {
			return { value: opt.value, label: opt.text };
		});

	// --- Scaffolding -------------------------------------------------
	const wrapper = document.createElement('div');
	setClass(wrapper, CLASS.wrapper);
	field.parentNode.insertBefore(wrapper, field);
	wrapper.appendChild(field);

	// The .auth-field [&_select]:block utility is !important, so the hidden
	// attribute alone will not hide it; force display off inline. The select
	// stays in the DOM (display:none still submits) as the source of truth.
	select.style.setProperty('display', 'none', 'important');
	select.setAttribute('tabindex', '-1');
	select.setAttribute('aria-hidden', 'true');
	// A required, display:none <select> makes native validation throw
	// "not focusable" and silently blocks submit; drop the client-side
	// required (the ChoiceField still enforces it server-side).
	select.removeAttribute('required');

	const row = document.createElement('div');
	setClass(row, CLASS.row);

	const input = document.createElement('input');
	input.type = 'text';
	input.autocomplete = 'off';
	input.spellcheck = false;
	input.id = (select.id || 'id_location_country') + '_combobox';
	input.setAttribute('role', 'combobox');
	input.setAttribute('aria-expanded', 'false');
	input.setAttribute('aria-controls', input.id + '_listbox');
	input.setAttribute('aria-autocomplete', 'list');
	input.setAttribute('placeholder', authI18n('data-country-placeholder', 'Search or select your country'));
	setClass(input, CLASS.input);
	if (label) label.setAttribute('for', input.id);

	const chevron = document.createElement('span');
	setClass(chevron, CLASS.chevron);
	chevron.setAttribute('aria-hidden', 'true');
	chevron.innerHTML = CHEVRON_SVG;

	row.appendChild(input);
	row.appendChild(chevron);
	field.appendChild(row);

	const listbox = document.createElement('ul');
	listbox.id = input.id + '_listbox';
	listbox.setAttribute('role', 'listbox');
	listbox.setAttribute(
		'aria-label',
		label ? label.textContent.trim() : authI18n('data-country-label', 'Country/Region')
	);
	setClass(listbox, CLASS.listbox + ' ' + CLASS.listClosed);
	wrapper.appendChild(listbox);

	// One <li> per country, reused across filters for stable ids.
	const items = options.map(function (opt, index) {
		const li = document.createElement('li');
		li.id = input.id + '_opt_' + index;
		li.setAttribute('role', 'option');
		li.setAttribute('aria-selected', 'false');
		li.dataset.value = opt.value;
		li.dataset.label = opt.label;
		setClass(li, CLASS.option);
		const name = document.createElement('span');
		name.textContent = opt.label;
		const check = document.createElement('span');
		check.innerHTML = CHECK_SVG;
		check.style.visibility = 'hidden';
		li.appendChild(name);
		li.appendChild(check);
		li._check = check;
		listbox.appendChild(li);
		return li;
	});

	const emptyEl = document.createElement('li');
	emptyEl.setAttribute('role', 'presentation');
	setClass(emptyEl, CLASS.empty);
	emptyEl.textContent = authI18n('data-country-no-results', 'No countries found');
	emptyEl.hidden = true;
	listbox.appendChild(emptyEl);

	// --- State -------------------------------------------------------
	let open = false;
	let activeIndex = -1;
	let currentValue = select.value || '';
	let currentLabel = '';
	(function initLabel() {
		for (let i = 0; i < options.length; i++) {
			if (options[i].value === currentValue) {
				currentLabel = options[i].label;
				break;
			}
		}
	})();
	input.value = currentLabel;

	// The .flex utility on each option is !important, so toggling the hidden
	// attribute will not hide it; drive visibility with an inline !important
	// display while keeping li.hidden as the source of truth for logic.
	function setHidden(el, hidden) {
		el.hidden = hidden;
		if (hidden) {
			el.style.setProperty('display', 'none', 'important');
		} else {
			el.style.removeProperty('display');
		}
	}

	function visibleItems() {
		return items.filter(function (li) {
			return !li.hidden;
		});
	}

	function filter(query) {
		const q = query.trim().toLowerCase();
		let anyVisible = false;
		items.forEach(function (li) {
			const match = !q || li.dataset.label.toLowerCase().indexOf(q) !== -1;
			setHidden(li, !match);
			if (match) anyVisible = true;
		});
		setHidden(emptyEl, anyVisible);
	}

	function setActive(index) {
		const vis = visibleItems();
		items.forEach(function (li) {
			removeClass(li, CLASS.optionActive);
		});
		activeIndex = index;
		if (index >= 0 && index < vis.length) {
			const li = vis[index];
			addClass(li, CLASS.optionActive);
			input.setAttribute('aria-activedescendant', li.id);
			li.scrollIntoView({ block: 'nearest' });
		} else {
			input.removeAttribute('aria-activedescendant');
		}
	}

	function openList(resetFilter) {
		if (resetFilter) filter('');
		if (open) return;
		open = true;
		input.setAttribute('aria-expanded', 'true');
		addClass(chevron, CLASS.chevronOpen);
		removeClass(listbox, CLASS.listClosed);
		addClass(listbox, CLASS.listOpen);
		// Highlight the current selection if visible, else the first match.
		const vis = visibleItems();
		let idx = -1;
		for (let i = 0; i < vis.length; i++) {
			if (vis[i].dataset.value === currentValue) {
				idx = i;
				break;
			}
		}
		setActive(idx === -1 ? (vis.length ? 0 : -1) : idx);
	}

	function closeList(revert) {
		if (!open) {
			if (revert) input.value = currentLabel;
			return;
		}
		open = false;
		input.setAttribute('aria-expanded', 'false');
		input.removeAttribute('aria-activedescendant');
		removeClass(chevron, CLASS.chevronOpen);
		removeClass(listbox, CLASS.listOpen);
		addClass(listbox, CLASS.listClosed);
		setActive(-1);
		if (revert) input.value = currentLabel;
	}

	function choose(li) {
		if (!li) return;
		const value = li.dataset.value;
		select.value = value;
		// Let existing listeners (e.g. unusual-country confirm) react, then re-sync
		// in case they reset the value.
		select.dispatchEvent(new Event('change', { bubbles: true }));
		currentValue = select.value;
		currentLabel = '';
		items.forEach(function (item) {
			const selected = item.dataset.value === currentValue;
			item.setAttribute('aria-selected', selected ? 'true' : 'false');
			item._check.style.visibility = selected ? 'visible' : 'hidden';
			if (selected) currentLabel = item.dataset.label;
		});
		input.value = currentLabel;
		closeList(false);
		input.focus();
	}

	// --- Events ------------------------------------------------------
	input.addEventListener('focus', function () {
		openList(true);
	});
	input.addEventListener('click', function () {
		openList(false);
	});

	input.addEventListener('input', function () {
		filter(input.value);
		if (!open) openList(false);
		setActive(visibleItems().length ? 0 : -1);
	});

	input.addEventListener('keydown', function (event) {
		let vis;
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (!open) {
					openList(false);
					return;
				}
				vis = visibleItems();
				setActive(Math.min(activeIndex + 1, vis.length - 1));
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (!open) {
					openList(false);
					return;
				}
				setActive(Math.max(activeIndex - 1, 0));
				break;
			case 'Home':
				if (open) {
					event.preventDefault();
					setActive(0);
				}
				break;
			case 'End':
				if (open) {
					event.preventDefault();
					setActive(visibleItems().length - 1);
				}
				break;
			case 'Enter':
				if (open && activeIndex >= 0) {
					event.preventDefault();
					choose(visibleItems()[activeIndex]);
				}
				break;
			case 'Escape':
				if (open) {
					event.preventDefault();
					closeList(true);
				}
				break;
			case 'Tab':
				closeList(true);
				break;
			default:
				break;
		}
	});

	listbox.addEventListener('mousedown', function (event) {
		// Prevent input blur before the click resolves.
		event.preventDefault();
	});
	listbox.addEventListener('click', function (event) {
		const li = event.target.closest('[role="option"]');
		if (li) choose(li);
	});
	items.forEach(function (li) {
		li.addEventListener('mousemove', function () {
			const vis = visibleItems();
			const pos = vis.indexOf(li);
			if (pos !== -1 && pos !== activeIndex) setActive(pos);
		});
	});

	// Close on outside interaction.
	document.addEventListener('focusin', function (event) {
		if (!wrapper.contains(event.target)) closeList(true);
	});
	document.addEventListener('mousedown', function (event) {
		if (!wrapper.contains(event.target)) closeList(true);
	});

	// Reflect the initial selection state on the options.
	items.forEach(function (item) {
		const selected = item.dataset.value === currentValue;
		item.setAttribute('aria-selected', selected ? 'true' : 'false');
		item._check.style.visibility = selected ? 'visible' : 'hidden';
	});

	if (reduceMotion) {
		listbox.classList.remove('transition', 'duration-150', 'ease-out');
	}
}

export function initCountryCombobox() {
	const select = document.querySelector('.auth-field select[name="location_country"]');
	if (select) enhance(select);
}
