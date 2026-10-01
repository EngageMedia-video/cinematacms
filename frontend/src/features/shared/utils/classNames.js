import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Match the spacing and radius namespaces registered in tailwind.css.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			spacing: [(value) => /^(?:size-\d+|space-(?:zero|px|xxs|xs2?|sm|base|md|lg|xl[2-6]?))$/.test(value)],
			radius: [(value) => /^ds-(?:\d+|full)$/.test(value)],
		},
	},
});

export function cn(...classes) {
	return twMerge(clsx(...classes));
}
