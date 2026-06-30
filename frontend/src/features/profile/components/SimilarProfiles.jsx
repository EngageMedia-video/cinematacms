import { Avatar, Card, Link, Text, UserRoleBadge } from '../../shared/components';
import { useSimilarProfiles } from '../hooks/useSimilarProfiles';
import { ProfileSectionHeader } from './ProfileSectionHeader';

function normalizeProfiles(data) {
	if (Array.isArray(data)) return data;
	return Array.isArray(data?.results) ? data.results : [];
}

export function SimilarProfiles({ author }) {
	const country = author.location_country || author.location_info?.[0]?.title || '';
	const { data, isLoading, isError } = useSimilarProfiles(author.username, country);
	const profiles = normalizeProfiles(data)
		.filter((profile) => profile.username !== author.username)
		.slice(0, 4);

	if (isError || (!isLoading && profiles.length === 0)) return null;

	return (
		<section aria-labelledby="similar-profiles-heading" className="rounded-lg border border-border-default p-4">
			<ProfileSectionHeader
				icon="profileSimilarProfiles"
				title="Similar Profiles"
				as="h2"
				id="similar-profiles-heading"
			/>
			<div className="mt-4 grid grid-cols-1 gap-5 sm:ml-[57px] sm:grid-cols-2 xl:grid-cols-4">
				{isLoading
					? Array.from({ length: 4 }, (_, index) => (
							<div
								key={index}
								className="h-[310px] animate-pulse rounded-xl bg-bg-skeleton"
								aria-hidden="true"
							/>
						))
					: profiles.map((profile) => {
							const name = profile.name || profile.username;
							return (
								<Card
									key={profile.username}
									className="flex min-h-[310px] flex-col items-center gap-4 p-6 text-center"
								>
									<Avatar
										name={name}
										src={profile.thumbnail_url || ''}
										alt={`${name}'s profile photo`}
										style={{ width: 80, height: 80 }}
									/>
									<div className="min-w-0">
										<Text as="h3" variant="h6" className="m-0 text-text-primary">
											{name}
										</Text>
										<Text as="p" variant="body-14" className="mt-1 mb-0 text-text-accent">
											@{profile.username}
										</Text>
									</div>
									<UserRoleBadge isManager={profile.is_manager} isTrusted={profile.is_trusted} />
									<Text as="p" variant="body-12" className="m-0 text-text-muted">
										{profile.location || 'Cinemata community'} ·{' '}
										{Number(profile.media_count || 0).toLocaleString()} videos
									</Text>
									<Link
										href={profile.url || `/user/${encodeURIComponent(profile.username)}`}
										variant="primary"
										className="mt-auto uppercase"
									>
										View Profile
									</Link>
								</Card>
							);
						})}
			</div>
		</section>
	);
}
