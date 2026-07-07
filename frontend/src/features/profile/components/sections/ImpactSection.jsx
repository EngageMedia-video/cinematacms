import { Text } from '../../../shared/components';
import { CommunityImpactSection } from '../../../video-viewer/components/community-impact';
import { useAuthorImpact } from '../../hooks/useAuthorImpact';

export function ImpactSection({ author }) {
	const { data, isLoading, isError } = useAuthorImpact(author.username);

	if (isLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-bg-skeleton" aria-label="Loading impact" />;
	}
	if (isError) return <Text className="text-text-danger">Community impact could not be loaded.</Text>;

	return (
		<CommunityImpactSection
			entries={data || {}}
			canAdd={false}
			title="Community Impact"
			description="Screenings, playlists, and discussions that show how this creator's work is reaching people."
		/>
	);
}
