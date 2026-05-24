import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

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

function GlobalSearchDropdownInner() {
	const [query, setQuery] = useState('');
	const [isOpen, setIsOpen] = useState(false);
	const debouncedQuery = useDebouncedValue(query, 300);
	const state = useGlobalSearch(debouncedQuery);

	const wrapperRef = useRef(null);
	const inputRef = useRef(null);
	const listboxId = useId();

	useEffect(() => {
		if (!isOpen) return undefined;
		function handleDocumentMouseDown(event) {
			if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		}
		function handleKeyDown(event) {
			if (event.key === 'Escape') {
				setIsOpen(false);
			}
		}
		document.addEventListener('mousedown', handleDocumentMouseDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('mousedown', handleDocumentMouseDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen]);

	function handleSubmit(event) {
		event.preventDefault();
		navigateToSearch(query);
	}

	function handleSelect() {
		setIsOpen(false);
	}

	function handleInputChange(event) {
		setQuery(event.target.value);
		if (!isOpen) setIsOpen(true);
	}

	function handleInputFocus() {
		setIsOpen(true);
	}

	return (
		<div ref={wrapperRef} data-modern-track className="relative w-full">
			<form onSubmit={handleSubmit} role="search">
				<div className="relative w-full">
					<input
						ref={inputRef}
						type="search"
						value={query}
						onChange={handleInputChange}
						onFocus={handleInputFocus}
						placeholder="Search for Films, Members, Events, etc"
						aria-label="Search"
						aria-controls={listboxId}
						aria-expanded={isOpen}
						autoComplete="off"
						className={cn(
							'body-body-14-regular block w-full rounded-[10px] border border-transparent bg-bg-chrome px-4 py-3 pr-12 text-text-on-chrome outline-none transition-colors duration-200',
							'placeholder:text-text-on-chrome-muted focus:border-border-input focus:ring-0',
							'[&::-webkit-search-cancel-button]:appearance-none'
						)}
					/>
					<span
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-text-on-chrome-muted"
					>
						<Icon name="magnifyingGlass" size={20} decorative />
					</span>
				</div>
			</form>

			{isOpen ? (
				<div
					id={listboxId}
					className={cn(
						'gs-scrollbar absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[70vh] overflow-y-auto rounded-[12px]',
						'border border-border-chrome/60 bg-cinemata-pacific-deep-900 shadow-2xl shadow-cinemata-black/40'
					)}
					style={{ animation: 'global-search-fade-in 180ms cubic-bezier(0.22, 1, 0.36, 1)' }}
				>
					<SearchResultsPanel state={state} query={debouncedQuery} onSelect={handleSelect} />
				</div>
			) : null}

			<style>{`
				@keyframes global-search-fade-in {
					from { opacity: 0; transform: translateY(-4px); }
					to { opacity: 1; transform: translateY(0); }
				}
				.gs-scrollbar {
					scrollbar-color: var(--cinemata-strait-blue-200) transparent;
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
					background-color: var(--cinemata-strait-blue-200);
					background-clip: content-box;
				}
			`}</style>
		</div>
	);
}

export function GlobalSearchDropdown() {
	return (
		<QueryClientProvider client={globalSearchQueryClient}>
			<GlobalSearchDropdownInner />
		</QueryClientProvider>
	);
}
