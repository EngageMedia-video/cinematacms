import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import { Icon, Link, Text } from '../../../shared/components';
import { useAuthorPlaylists } from '../../hooks/useAuthorPlaylists';
import { useOwnerMedia } from '../../hooks/useOwnerMedia';
import { normalizeMediaList } from '../../utils/media';
import { MediaGrid } from '../MediaGrid';
import { ProfileSectionHeader } from '../ProfileSectionHeader';
import { SimilarProfiles } from '../SimilarProfiles';

function normalizeList(data) {
	if (Array.isArray(data)) return data;
	return Array.isArray(data?.results) ? data.results : [];
}

function getSafeExternalUrl(value) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
	} catch {
		return '';
	}
}

function Details({ author }) {
	const location = author.location || author.location_info?.[0]?.title;
	const socialLinks = String(author.social_media_links || '')
		.split(',')
		.map((link) => link.trim())
		.map(getSafeExternalUrl)
		.filter(Boolean);
	const homePage = getSafeExternalUrl(author.home_page);
	const rows = [
		{ label: 'Location', value: location, icon: 'members' },
		{ label: 'Website', value: homePage, href: homePage, icon: 'link' },
	];

	return (
		<section className="rounded-lg border border-border-default p-4">
			<ProfileSectionHeader icon="profileDetails" title="Details" />
			<dl className="mt-4 grid gap-3 sm:ml-[57px]">
				{rows
					.filter((row) => row.value)
					.map((row) => (
						<div key={row.label} className="grid gap-1 sm:grid-cols-[120px_1fr]">
							<dt className="body-body-14-regular inline-flex items-center gap-2 text-text-muted">
								<Icon name={row.icon} size="xs" decorative />
								{row.label}
							</dt>
							<dd className="body-body-14-regular m-0 min-w-0 break-words text-text-primary">
								{row.href ? (
									<a
										href={row.href}
										target="_blank"
										rel="noreferrer"
										className="text-text-link hover:text-text-link-hover"
									>
										{row.value}
									</a>
								) : (
									row.value
								)}
							</dd>
						</div>
					))}
			</dl>
			{socialLinks.length ? (
				<div className="mt-4 flex flex-wrap gap-3 sm:ml-[57px]">
					{socialLinks.map((url) => (
						<a
							key={url}
							href={url}
							target="_blank"
							rel="noreferrer"
							className="body-body-12-regular text-text-link hover:text-text-link-hover"
						>
							{new URL(url).hostname.replace(/^www\./, '')}
						</a>
					))}
				</div>
			) : null}
		</section>
	);
}

function RecentPlaylists({ playlists, author }) {
	if (!playlists.length) return null;

	return (
		<section className="rounded-lg border border-border-default p-4">
			<ProfileSectionHeader
				icon="profileRecentPlaylists"
				title="Recent Playlists"
				action={<Link href={`/user/${encodeURIComponent(author.username)}/playlists`}>View all</Link>}
			/>
			<ul className="mt-4 grid list-none gap-4 p-0 sm:ml-[57px]">
				{playlists.slice(0, 4).map((playlist) => (
					<li key={playlist.url || playlist.title} className="flex min-w-0 gap-3">
						<a
							href={playlist.url}
							className="relative h-[135px] w-[180px] shrink-0 overflow-hidden rounded"
							aria-label={`Play all in ${playlist.title}`}
						>
							<img
								src={playlist.thumbnail_url}
								alt=""
								width="180"
								height="135"
								loading="lazy"
								className="h-full w-full object-cover"
							/>
							<span className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2 bg-bg-overlay-dark/80 py-[10px]">
								<Icon name="play" size="sm" className="text-text-on-chrome" decorative />
								<Text as="span" variant="body-14-medium" className="text-text-on-chrome uppercase">
									Play all
								</Text>
							</span>
						</a>
						<div className="min-w-0">
							<a
								href={playlist.url}
								className="body-body-16-medium text-text-primary hover:text-text-link-hover"
							>
								{playlist.title}
							</a>
							<Text as="p" variant="body-12" className="mt-2 mb-0 text-text-muted">
								{playlist.media_count || 0} films
							</Text>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

export function AboutSection({ author }) {
	const favoritesQuery = useOwnerMedia(author.username, 'liked', author.is_owner);
	const playlistQuery = useAuthorPlaylists(author.username);
	const favorites = normalizeMediaList(favoritesQuery.data).slice(0, 4);
	const playlists = normalizeList(playlistQuery.data);
	const sanitizedBiography = useMemo(() => DOMPurify.sanitize(author.description || ''), [author.description]);
	const showPlaylists = playlistQuery.isSuccess && playlists.length > 0;

	return (
		<div className="space-y-4">
			<div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
				<section className="rounded-lg border border-border-default p-4">
					<ProfileSectionHeader icon="profileBionote" title="Bionote" />
					{sanitizedBiography ? (
						<div
							className="body-body-14-regular mt-4 space-y-3 text-text-primary sm:ml-[57px] [&_a]:text-text-link [&_p]:m-0"
							dangerouslySetInnerHTML={{ __html: sanitizedBiography }}
						/>
					) : (
						<Text as="p" variant="body-14" className="mt-4 mb-0 text-text-muted sm:ml-[57px]">
							{author.is_owner
								? 'Tell the Cinemata community about yourself.'
								: `${author.name || author.username} has not added a biography yet.`}
						</Text>
					)}
				</section>
				<Details author={author} />
			</div>

			{author.is_owner || showPlaylists ? (
				<div className={`grid gap-4 ${author.is_owner && showPlaylists ? 'xl:grid-cols-2' : ''}`}>
					{author.is_owner ? (
						<section className="rounded-lg border border-border-default p-4">
							<ProfileSectionHeader icon="profileFavoriteFilms" title="Favorite Films" />
							{favoritesQuery.isLoading ? (
								<div
									className="mt-4 h-24 animate-pulse rounded-lg bg-bg-skeleton sm:ml-[57px]"
									aria-label="Loading favorite films"
								/>
							) : favoritesQuery.isError ? (
								<Text as="p" variant="body-14" className="mt-4 mb-0 text-text-danger sm:ml-[57px]">
									Favorite films could not be loaded.
								</Text>
							) : favorites.length ? (
								<div className="mt-4 sm:ml-[57px]">
									<MediaGrid items={favorites} layout="compact" />
								</div>
							) : (
								<Text as="p" variant="body-14" className="mt-4 mb-0 text-text-muted sm:ml-[57px]">
									No favorite films yet.
								</Text>
							)}
						</section>
					) : null}
					{showPlaylists ? <RecentPlaylists playlists={playlists} author={author} /> : null}
				</div>
			) : null}

			<SimilarProfiles author={author} />
		</div>
	);
}
