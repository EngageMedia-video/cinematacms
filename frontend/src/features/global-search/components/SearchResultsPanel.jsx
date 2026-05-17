import { Text } from '../../shared/components/Text';
import { EmptyState } from './EmptyState';
import { IdleHint } from './IdleHint';
import { LoadingState } from './LoadingState';
import { MemberResultRow } from './MemberResultRow';
import { PlaylistResultRow } from './PlaylistResultRow';
import { SearchResultSection } from './SearchResultSection';
import { VideoResultRow } from './VideoResultRow';

function encode(query) {
	return encodeURIComponent(query);
}

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
				<Text variant="body-14" className="m-0 text-cinemata-strait-blue-50">
					Search failed
				</Text>
				<Text variant="body-12" className="m-0 text-cinemata-pacific-deep-300">
					Check your connection and try again.
				</Text>
			</div>
		);
	}

	if (state.isEmpty) {
		return <EmptyState query={query} />;
	}

	const q = encode(query);

	return (
		<div className="flex flex-col">
			<SearchResultSection
				title="Videos"
				items={state.videos.items}
				hasMore={state.videos.hasMore}
				showMoreHref={`/search?q=${q}`}
				isError={state.videos.isError}
				onSelect={onSelect}
				renderItem={(item, idx, onItemSelect) => (
					<VideoResultRow key={`v-${item.friendly_token || idx}`} item={item} onSelect={onItemSelect} />
				)}
			/>
			<SearchResultSection
				title="Playlists"
				items={state.playlists.items}
				hasMore={state.playlists.hasMore}
				showMoreHref={null}
				isError={state.playlists.isError}
				onSelect={onSelect}
				renderItem={(item, idx, onItemSelect) => (
					<PlaylistResultRow key={`p-${item.url || idx}`} item={item} onSelect={onItemSelect} />
				)}
			/>
			<SearchResultSection
				title="Members"
				items={state.members.items}
				hasMore={state.members.hasMore}
				showMoreHref={`/members?search=${q}`}
				isError={state.members.isError}
				onSelect={onSelect}
				renderItem={(item, idx, onItemSelect) => (
					<MemberResultRow key={`m-${item.username || idx}`} item={item} onSelect={onItemSelect} />
				)}
			/>
		</div>
	);
}
