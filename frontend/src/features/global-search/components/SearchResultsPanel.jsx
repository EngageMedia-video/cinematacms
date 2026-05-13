import { EmptyState } from './EmptyState';
import { IdleHint } from './IdleHint';
import { LoadingState } from './LoadingState';
import { MemberResultRow } from './MemberResultRow';
import { PlaylistResultRow } from './PlaylistResultRow';
import { SearchResultSection } from './SearchResultSection';
import { VideoResultRow } from './VideoResultRow';

export function SearchResultsPanel({ state, query, onSelect }) {
	if (!state.enabled) {
		return <IdleHint />;
	}

	if (state.isLoading) {
		return <LoadingState />;
	}

	if (state.isError) {
		return (
			<div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
				<p className="body-body-14-medium text-cinemata-strait-blue-50">Search failed</p>
				<p className="body-body-12-regular text-cinemata-pacific-deep-300">
					Check your connection and try again.
				</p>
			</div>
		);
	}

	if (state.isEmpty) {
		return <EmptyState query={query} />;
	}

	return (
		<div className="flex flex-col">
			<SearchResultSection
				title="Videos"
				items={state.videos.items}
				hasMore={state.videos.hasMore}
				query={query}
				onSelect={onSelect}
				renderItem={(item, idx, onItemSelect) => (
					<VideoResultRow key={`v-${item.friendly_token || idx}`} item={item} onSelect={onItemSelect} />
				)}
			/>
			<SearchResultSection
				title="Playlists"
				items={state.playlists.items}
				hasMore={state.playlists.hasMore}
				query={query}
				onSelect={onSelect}
				renderItem={(item, idx, onItemSelect) => (
					<PlaylistResultRow key={`p-${item.url || idx}`} item={item} onSelect={onItemSelect} />
				)}
			/>
			<SearchResultSection
				title="Members"
				items={state.members.items}
				hasMore={state.members.hasMore}
				query={query}
				onSelect={onSelect}
				renderItem={(item, idx, onItemSelect) => (
					<MemberResultRow key={`m-${item.username || idx}`} item={item} onSelect={onItemSelect} />
				)}
			/>
		</div>
	);
}
