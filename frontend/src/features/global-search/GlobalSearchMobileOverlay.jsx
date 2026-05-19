import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import '../../static/css/tailwind.css';

import { Icon } from '../shared/components/Icon';
import { cn } from '../shared/utils/classNames';
import { SearchResultsPanel } from './components/SearchResultsPanel';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import globalSearchQueryClient from './queryClient';

function navigateToSearch(query) {
	const trimmed = (query || '').trim();
	if (!trimmed) return;
	window.location.href = `/search?q=${encodeURIComponent(trimmed)}`;
}

function GlobalSearchMobileOverlayInner({ isOpen, onClose }) {
	const [query, setQuery] = useState('');
	const debouncedQuery = useDebouncedValue(query, 300);
	const state = useGlobalSearch(debouncedQuery);
	const inputRef = useRef(null);

	useEffect(() => {
		if (!isOpen) return undefined;
		const timer = setTimeout(() => inputRef.current?.focus(), 50);
		function onKey(event) {
			if (event.key === 'Escape') onClose();
		}
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', onKey);
		return () => {
			clearTimeout(timer);
			document.body.style.overflow = prevOverflow;
			document.removeEventListener('keydown', onKey);
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	function handleSubmit(event) {
		event.preventDefault();
		navigateToSearch(query);
	}

	function handleInputChange(event) {
		setQuery(event.target.value);
	}

	function handleSelect() {
		onClose();
	}

	return createPortal(
		<div
			data-modern-track
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			className="fixed inset-0 z-[100] flex flex-col bg-cinemata-pacific-deep-950"
		>
			<div className="flex items-center gap-2 border-b border-cinemata-pacific-deep-700/60 bg-cinemata-pacific-deep-900 px-3 py-3">
				<button
					type="button"
					onClick={onClose}
					aria-label="Close search"
					className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-cinemata-strait-blue-50 transition-colors duration-150 hover:bg-cinemata-pacific-deep-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p"
				>
					<Icon name="chevronLeft" size={22} decorative />
				</button>
				<form onSubmit={handleSubmit} role="search" className="flex-1">
					<div className="relative w-full">
						<input
							ref={inputRef}
							type="search"
							value={query}
							onChange={handleInputChange}
							placeholder="Search for Films, Members, Events, etc"
							aria-label="Search"
							autoComplete="off"
							className={cn(
								'body-body-14-regular block w-full rounded-[10px] border border-transparent bg-cinemata-pacific-deep-800 px-4 py-3 pr-12 text-cinemata-strait-blue-50 outline-none transition-colors duration-200',
								'placeholder:text-cinemata-pacific-deep-300 focus:border-cinemata-sunset-horizon-400p focus:ring-0',
								'[&::-webkit-search-cancel-button]:appearance-none'
							)}
						/>
						<span
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-cinemata-pacific-deep-300"
						>
							<Icon name="magnifyingGlass" size={20} decorative />
						</span>
					</div>
				</form>
			</div>
			<div className="gs-scrollbar flex-1 overflow-y-auto">
				<SearchResultsPanel state={state} query={debouncedQuery} onSelect={handleSelect} />
			</div>
			<style>{`
				.gs-scrollbar {
					scrollbar-color: rgba(2, 102, 144, 0.35) transparent;
					scrollbar-width: thin;
				}
				.gs-scrollbar::-webkit-scrollbar {
					width: 6px;
				}
				.gs-scrollbar::-webkit-scrollbar-track {
					background: transparent;
				}
				.gs-scrollbar::-webkit-scrollbar-thumb {
					border: 2px solid transparent;
					border-radius: 999px;
					background-color: rgba(2, 102, 144, 0.35);
					background-clip: content-box;
				}
			`}</style>
		</div>,
		document.body
	);
}

export function GlobalSearchMobileOverlay({ isOpen, onClose }) {
	return (
		<QueryClientProvider client={globalSearchQueryClient}>
			<GlobalSearchMobileOverlayInner isOpen={isOpen} onClose={onClose} />
		</QueryClientProvider>
	);
}
