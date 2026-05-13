import React, { useContext, useEffect, useRef } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import { Icon } from '../../shared/components/Icon';
import { SearchBar } from '../../shared/components/SearchBar';
import useTopbarStore from './useTopbarStore';

export function TopbarSearchMobileOverlay() {
	const links = useContext(LinksContext);
	const isOpen = useTopbarStore((state) => state.isMobileSearchOpen);
	const close = useTopbarStore((state) => state.closeMobileSearch);
	const inputRef = useRef(null);

	useEffect(() => {
		if (isOpen) {
			const timer = setTimeout(() => inputRef.current?.focus(), 50);
			return () => clearTimeout(timer);
		}
	}, [isOpen]);

	if (!isOpen) {
		return null;
	}

	function onSubmit(event) {
		const value = inputRef.current?.value?.trim() ?? '';
		if (value === '') {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	return (
		<div
			data-modern-track
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			className="fixed inset-0 z-[70] bg-cinemata-pacific-deep-950 p-4 flex items-center gap-3 sm:hidden"
		>
			<button
				type="button"
				onClick={close}
				aria-label="Close search"
				className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-cinemata-pacific-deep-800 text-cinemata-white hover:bg-cinemata-pacific-deep-700 transition-colors shrink-0"
			>
				<Icon name="chevronLeft" size={20} decorative />
			</button>
			<form
				role="search"
				method="GET"
				action={links?.search?.base || '/search/'}
				autoComplete="off"
				onSubmit={onSubmit}
				className="flex-1"
			>
				<SearchBar
					ref={inputRef}
					name="q"
					placeholder="Search for Films, Members, Events, etc"
					aria-label="Search"
				/>
			</form>
		</div>
	);
}
