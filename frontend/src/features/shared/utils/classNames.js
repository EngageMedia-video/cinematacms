import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...classes) {
	return twMerge(clsx(...classes));
}
