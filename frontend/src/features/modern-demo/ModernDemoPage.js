import React, { useContext } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { usePage, PageLayout } from '../../static/js/pages/page';
import ApiUrlContext from '../../static/js/contexts/ApiUrlContext';
import SiteContext from '../../static/js/contexts/SiteContext';
import useDemoStore from './useDemoStore';

import '../../static/css/tailwind.css';

function formatDuration(seconds) {
	if (!seconds) return null;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateString) {
	if (!dateString) return '';
	const diff = Date.now() - new Date(dateString).getTime();
	const days = Math.floor(diff / 86400000);
	if (days < 1) return 'today';
	if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
	const years = Math.floor(months / 12);
	return `${years} year${years > 1 ? 's' : ''} ago`;
}

function MediaGrid({ items }) {
	const viewMode = useDemoStore((s) => s.viewMode);

	if (!items.length) {
		return <p className="text-content-body py-8 text-center">No media found.</p>;
	}

	if (viewMode === 'list') {
		return (
			<div className="flex flex-col gap-4">
				{items.map((item) => {
					const duration = formatDuration(item.duration);
					const country = item.media_country_info?.[0]?.title;
					return (
						<a key={item.friendly_token} href={item.url} className="flex no-underline text-inherit gap-4">
							<div className="relative w-44 shrink-0">
								{item.thumbnail_url && (
									<img
										src={item.thumbnail_url}
										alt={item.title}
										className="aspect-video w-full rounded-md object-cover"
										loading="lazy"
										decoding="async"
									/>
								)}
								{duration && (
									<span className="absolute right-1 bottom-1 rounded-sm bg-black/80 px-1 py-0.5 text-[11px] font-medium tracking-wide text-white">
										{duration}
									</span>
								)}
							</div>
							<div className="min-w-0 py-0.5">
								<h3 className="line-clamp-2 text-sm font-medium leading-[18px] text-content-body">
									{item.title}
								</h3>
								<p className="mt-1 text-[13px] leading-[18px] text-brand-primary">{item.user}</p>
								<p className="mt-0.5 text-[13px] leading-[18px] text-content-body/60">
									{country && <>{country} &middot; </>}
									{item.views} view{item.views !== 1 ? 's' : ''}
									{item.add_date && <> &middot; {timeAgo(item.add_date)}</>}
								</p>
							</div>
						</a>
					);
				})}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 xl:grid-cols-4">
			{items.map((item) => {
				const duration = formatDuration(item.duration);
				const country = item.media_country_info?.[0]?.title;

				return (
					<a key={item.friendly_token} href={item.url} className="block no-underline text-inherit">
						{/* Thumbnail */}
						<div className="relative overflow-hidden rounded-md">
							{item.thumbnail_url ? (
								<img
									src={item.thumbnail_url}
									alt={item.title}
									className="aspect-video w-full object-cover"
									loading="lazy"
									decoding="async"
								/>
							) : (
								<div className="aspect-video w-full bg-surface-sidebar" />
							)}
							{duration && (
								<span className="absolute right-1 bottom-1 rounded-sm bg-black/80 px-1 py-0.5 text-[11px] font-medium tracking-wide text-white">
									{duration}
								</span>
							)}
						</div>

						{/* Title — 2-line clamp like legacy */}
						<h3 className="mt-3 mb-2 line-clamp-2 text-sm font-medium leading-[18px] text-content-body">
							{item.title}
						</h3>

						{/* Author */}
						<p className="text-[13px] leading-[18px] text-brand-primary">{item.user}</p>

						{/* Meta: country · views · date */}
						<p className="text-[13px] leading-[18px] text-content-body/60">
							{country && <>{country} &middot; </>}
							{item.views} view{item.views !== 1 ? 's' : ''}
							{item.add_date && <> &middot; {timeAgo(item.add_date)}</>}
						</p>
					</a>
				);
			})}
		</div>
	);
}

function DemoContent() {
	const apiUrl = useContext(ApiUrlContext);
	const site = useContext(SiteContext);

	const viewMode = useDemoStore((s) => s.viewMode);
	const searchQuery = useDemoStore((s) => s.searchQuery);
	const setViewMode = useDemoStore((s) => s.setViewMode);
	const setSearchQuery = useDemoStore((s) => s.setSearchQuery);

	// NOTE: This demo fetches only page 1 (~50 items) and filters client-side.
	// For production features, pass the search query as a server-side parameter:
	//   queryKey: ['media', { q: debouncedQuery }]
	//   queryFn: () => axios.get(apiUrl.search, { params: { q: debouncedQuery } })
	const { data, isLoading, isError, error } = useQuery({
		queryKey: ['demo-media'],
		queryFn: async () => {
			const res = await axios.get(apiUrl.media);
			return res.data?.results ?? res.data ?? [];
		},
	});

	const filteredItems = (data || []).filter((item) => item.title?.toLowerCase().includes(searchQuery.toLowerCase()));

	return (
		<div data-modern-track className="mx-auto max-w-5xl px-4 py-6">
			<h1 className="mb-2 text-2xl font-bold text-content-body">Modern Track Demo</h1>
			<p className="mb-6 text-sm text-content-body/60">
				This page demonstrates the modern track architecture: TanStack Query for server state, Zustand for
				client state, and Tailwind CSS for styling. Built on {site.title || 'CinemataCMS'}.
			</p>

			{/* Controls */}
			<div className="mb-6 flex flex-wrap items-center gap-3">
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Filter by title..."
					aria-label="Filter media by title"
					className="rounded border border-border-input bg-surface-input px-3 py-1.5 text-sm text-content-input outline-none"
				/>
				<div className="flex rounded border border-border-input" role="group" aria-label="View mode">
					<button
						onClick={() => setViewMode('grid')}
						aria-pressed={viewMode === 'grid'}
						className={`border-0 px-3 py-1.5 text-xs ${viewMode === 'grid' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-body'}`}
					>
						Grid
					</button>
					<button
						onClick={() => setViewMode('list')}
						aria-pressed={viewMode === 'list'}
						className={`border-0 px-3 py-1.5 text-xs ${viewMode === 'list' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-body'}`}
					>
						List
					</button>
				</div>
			</div>

			{/* Media content */}
			{isLoading && <p className="py-8 text-center text-content-body/60">Loading media...</p>}
			{isError && !data && (
				<p className="py-8 text-center text-content-error" role="alert">
					Failed to load media: {error?.message || 'Is the API running?'}
				</p>
			)}
			{data && <MediaGrid items={filteredItems} />}

			{/* Comparison panel */}
			<div className="mt-10 rounded border border-border-input p-4">
				<h2 className="mb-4 text-lg font-semibold text-content-body">Architecture Comparison</h2>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded bg-surface-sidebar p-3">
						<h3 className="mb-2 text-sm font-medium text-content-body">Legacy Pattern</h3>
						<pre className="overflow-x-auto text-xs text-content-body/80">
							{`// LayoutStore.js (~124 lines)
class LayoutStore extends EventEmitter {
  constructor() {
    super();
    this.state = { viewMode: 'grid' };
  }
  actions_handler(action) {
    switch(action.type) {
      case 'SET_VIEW':
        this.state.viewMode = action.mode;
        this.emit('change');
    }
  }
}
export default exportStore(
  new LayoutStore, 'actions_handler'
);`}
						</pre>
					</div>
					<div className="rounded bg-surface-sidebar p-3">
						<h3 className="mb-2 text-sm font-medium text-content-body">Modern Pattern</h3>
						<pre className="overflow-x-auto text-xs text-content-body/80">
							{`// useDemoStore.js (~10 lines)
import { create } from 'zustand';

const useDemoStore = create((set) => ({
  viewMode: 'grid',
  setViewMode: (mode) =>
    set({ viewMode: mode }),
}));

// In component:
const mode = useDemoStore(s => s.viewMode);`}
						</pre>
					</div>
				</div>
			</div>
		</div>
	);
}

class DemoErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	render() {
		if (this.state.hasError) {
			return <p className="py-8 text-center text-content-body">Something went wrong loading this page.</p>;
		}
		return this.props.children;
	}
}

export default function ModernDemoPage() {
	const [queryClient] = React.useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						refetchOnWindowFocus: false,
					},
				},
			})
	);

	usePage('modern-demo');

	return (
		<QueryClientProvider client={queryClient}>
			<PageLayout>
				<DemoErrorBoundary>
					<DemoContent />
				</DemoErrorBoundary>
			</PageLayout>
		</QueryClientProvider>
	);
}
