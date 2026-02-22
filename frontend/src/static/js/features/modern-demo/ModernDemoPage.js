import React, { useContext } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { usePage, PageLayout } from '../../pages/page';
import ApiUrlContext from '../../contexts/ApiUrlContext';
import SiteContext from '../../contexts/SiteContext';
import useDemoStore from './useDemoStore';

import '../../../css/tailwind.css';

// Scoped QueryClient — must NOT leak into shared components.
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30000,
			refetchOnWindowFocus: false,
		},
	},
});

function MediaGrid({ items }) {
	const viewMode = useDemoStore((s) => s.viewMode);

	if (!items.length) {
		return <p className="text-content-body py-8 text-center">No media found.</p>;
	}

	const containerClass =
		viewMode === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-3';

	return (
		<div className={containerClass}>
			{items.map((item) => (
				<a
					key={item.url}
					href={item.url}
					className="block overflow-hidden rounded border border-border-input bg-surface-body transition-shadow hover:shadow-md"
				>
					{item.thumbnail_url && (
						<img
							src={item.thumbnail_url}
							alt={item.title}
							className="aspect-video w-full object-cover"
							loading="lazy"
						/>
					)}
					<div className="p-3">
						<h3 className="truncate text-sm font-medium text-content-body">{item.title}</h3>
						<p className="mt-1 text-xs text-content-body/60">
							{item.author_name} &middot; {item.views} views
						</p>
					</div>
				</a>
			))}
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

	const { data, isLoading, isError } = useQuery({
		queryKey: ['demo-media'],
		queryFn: async () => {
			const res = await axios.get(apiUrl.media);
			return res.data?.results ?? res.data ?? [];
		},
	});

	const filteredItems = (data || []).filter((item) => item.title?.toLowerCase().includes(searchQuery.toLowerCase()));

	return (
		<div className="mx-auto max-w-5xl px-4 py-6">
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
					className="rounded border border-border-input bg-surface-input px-3 py-1.5 text-sm text-content-input outline-none"
				/>
				<div className="flex rounded border border-border-input">
					<button
						onClick={() => setViewMode('grid')}
						className={`px-3 py-1.5 text-xs ${viewMode === 'grid' ? 'bg-brand-primary text-white' : 'text-content-body'}`}
					>
						Grid
					</button>
					<button
						onClick={() => setViewMode('list')}
						className={`px-3 py-1.5 text-xs ${viewMode === 'list' ? 'bg-brand-primary text-white' : 'text-content-body'}`}
					>
						List
					</button>
				</div>
			</div>

			{/* Media content */}
			{isLoading && <p className="py-8 text-center text-content-body/60">Loading media...</p>}
			{isError && <p className="py-8 text-center text-red-600">Failed to load media. Is the API running?</p>}
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

export default function ModernDemoPage() {
	usePage('modern-demo');

	return (
		<QueryClientProvider client={queryClient}>
			<PageLayout>
				<DemoContent />
			</PageLayout>
		</QueryClientProvider>
	);
}
