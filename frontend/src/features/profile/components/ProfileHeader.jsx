import { useState } from 'react';
import { Avatar, Button, Icon, Link, Text, UserRoleBadge } from '../../shared/components';
import { apiFetch } from '../../shared/utils/api';
import { getJoinedLabel } from '../utils/joinedDate';

function getLocation(author) {
	return author.location || author.location_info?.[0]?.title || '';
}

export function ProfileHeader({ author }) {
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState('');
	const displayName = author.name || author.username;
	const roleText = [author.title, author.institution].filter(Boolean).join(', ');
	const location = getLocation(author);

	async function deleteProfile() {
		if (!window.confirm(`Delete ${displayName}'s account? This cannot be undone.`)) return;
		setDeleting(true);
		setDeleteError('');
		try {
			const response = await apiFetch(`/api/v1/users/${encodeURIComponent(author.username)}`, {
				method: 'DELETE',
			});
			if (response.ok) {
				window.location.assign('/');
				return;
			}
			setDeleteError('The account could not be deleted. Please try again.');
		} catch {
			setDeleteError('The account could not be deleted. Check your connection and try again.');
		} finally {
			setDeleting(false);
		}
	}

	return (
		<header className="flex flex-col gap-6 px-4 py-6 sm:px-8">
			<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
				<div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
					<Avatar
						name={displayName}
						src={author.thumbnail_url || ''}
						alt={`${displayName}'s profile photo`}
						className="ring-4 ring-bg-page"
						style={{ width: 83, height: 83 }}
					/>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<Text as="h1" variant="h4-bold" className="m-0 text-text-primary">
								{displayName}
							</Text>
							{author.email_is_verified ? (
								<Icon name="check" size="sm" label="Verified account" className="text-text-success" />
							) : null}
						</div>
						<Text as="p" variant="body-16" className="mt-1 mb-0 text-text-accent">
							@{author.username}
						</Text>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<UserRoleBadge isManager={author.is_manager} isTrusted={author.is_trusted} />
							{roleText ? (
								<Text as="span" variant="caption-10" className="uppercase text-text-muted">
									{roleText}
								</Text>
							) : null}
						</div>
						<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-text-muted">
							{location ? (
								<span className="body-body-14-regular inline-flex items-center gap-2">
									<Icon name="members" size="xs" decorative />
									{location}
								</span>
							) : null}
							<span className="body-body-14-regular inline-flex items-center gap-2">
								<Icon name="myMedia" size="xs" decorative />
								{Number(author.media_count || 0).toLocaleString()} videos
							</span>
							<span className="body-body-14-regular inline-flex items-center gap-2">
								<Icon name="clock" size="xs" decorative />
								{getJoinedLabel(author.date_added)}
							</span>
						</div>
					</div>
				</div>

				{author.can_edit || author.can_delete ? (
					<div className="shrink-0">
						<div className="flex flex-wrap items-center gap-2">
							{author.can_edit ? (
								<Link href={author.edit_url} variant="secondary" className="uppercase">
									Edit Profile
								</Link>
							) : null}
							{author.can_delete ? (
								<Button
									variant="text"
									className="text-text-danger hover:text-text-danger"
									disabled={deleting}
									onClick={deleteProfile}
								>
									{deleting ? 'Deleting…' : 'Delete Account'}
								</Button>
							) : null}
						</div>
						{deleteError ? (
							<Text as="p" variant="body-12" className="mt-2 mb-0 text-text-danger" role="alert">
								{deleteError}
							</Text>
						) : null}
					</div>
				) : null}
			</div>
		</header>
	);
}
