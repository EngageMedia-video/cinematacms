import React, { useContext, useRef } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import { SearchBar } from '../../shared/components/SearchBar';

export function TopbarSearchDesktop() {
	const links = useContext(LinksContext);
	const inputRef = useRef(null);

	function onSubmit(event) {
		const value = inputRef.current?.value?.trim() ?? '';
		if (value === '') {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	return (
		<form
			role="search"
			method="GET"
			action={links?.search?.base || '/search/'}
			autoComplete="off"
			onSubmit={onSubmit}
			className="hidden sm:flex flex-1 max-w-[640px] mx-auto"
		>
			<SearchBar
				ref={inputRef}
				name="q"
				placeholder="Search for Films, Members, Events, etc"
				aria-label="Search"
			/>
		</form>
	);
}
