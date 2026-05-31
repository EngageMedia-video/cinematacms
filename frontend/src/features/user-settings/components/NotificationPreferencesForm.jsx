import React, { useEffect, useMemo, useState } from 'react';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { useUpdateNotificationPreferences } from '../hooks/useUpdateNotificationPreferences';
import { Switch } from '../../shared/components/Switch';

const PREFERENCE_CATEGORIES = [
	{
		id: 'security',
		title: 'Security & Privacy Alerts',
		items: [
			{ label: 'Account login from new device', status: 'coming_soon' },
			{ label: 'Changes to film visibility', status: 'coming_soon' },
			{ label: 'Download enabled on your film', status: 'coming_soon' },
			{ label: 'Password removed or changed', status: 'coming_soon' },
			{ label: 'Suspicious activity detected', status: 'coming_soon' },
		],
	},
	{
		id: 'upload',
		title: 'Upload & Archive Updates',
		items: [
			{ label: 'Upload completed', status: 'coming_soon' },
			{ label: 'Upload failed', status: 'coming_soon' },
			{ label: 'Processing completed', status: 'coming_soon' },
			{ key: 'on_new_media_from_following', label: 'New films from people you follow', status: 'active' },
			{ label: 'Scheduled visibility change', status: 'coming_soon' },
		],
	},
	{
		id: 'engagement',
		title: 'Engagement & Discussions',
		items: [
			{ key: 'on_comment', label: 'New comment on your film', status: 'active' },
			{ key: 'on_reply', label: 'Replies to your comment', status: 'active' },
			{ key: 'on_like', label: 'New reactions to your film', status: 'active' },
			{ key: 'on_follow', label: 'New followers', status: 'active' },
			{ key: 'on_mention', label: 'Mentions in comments', status: 'active' },
		],
	},
	{
		id: 'institutional',
		title: 'Institutional / Access Notifications',
		items: [
			{ label: 'Film accessed by reviewer', status: 'coming_soon' },
			{
				key: 'on_added_to_playlist',
				label: 'Film added to a curated collection',
				status: 'active',
			},
			{ label: 'Request for screening or usage permission', status: 'coming_soon' },
		],
	},
];

const ALL_KEYS = PREFERENCE_CATEGORIES.flatMap((cat) =>
	cat.items.filter((i) => i.status === 'active' && i.key).map((i) => i.key)
);

function activeKeysFor(category) {
	return category.items.filter((i) => i.status === 'active' && i.key).map((i) => i.key);
}

function arePrefsEqual(a, b) {
	if (!a || !b) return false;
	return ALL_KEYS.every((key) => a[key] === b[key]);
}

function ComingSoonPill() {
	return (
		<span className="rounded-[4px] bg-bg-surface-muted px-[6px] py-[2px] text-[11px] font-medium leading-[14px] tracking-normal text-text-muted">
			Coming soon
		</span>
	);
}

export function NotificationPreferencesForm() {
	const { data, isLoading, isError, error } = useNotificationPreferences();
	const {
		mutate,
		isPending,
		isSuccess,
		isError: isSaveError,
		error: saveError,
		reset,
	} = useUpdateNotificationPreferences();

	const [draft, setDraft] = useState(null);

	useEffect(() => {
		if (data && draft === null) setDraft(data);
	}, [data, draft]);

	const isDirty = useMemo(() => isDirtyState(draft, data), [draft, data]);

	if (isLoading) {
		return <p className="px-4 py-8 text-center text-[14px] leading-5 text-text-secondary">Loading…</p>;
	}

	if (isError) {
		return (
			<p className="px-4 py-8 text-center text-[14px] leading-5 text-text-secondary">
				Failed to load preferences: {error?.message ?? 'unknown error'}
			</p>
		);
	}

	if (!draft) return null;

	function clearSaveStatus() {
		if (isSuccess || isSaveError) reset();
	}

	function setEventEnabled(key, enabled, categoryEmailOn) {
		setDraft((prev) => ({
			...prev,
			[key]: enabled ? (categoryEmailOn ? 'email' : 'in_app') : 'none',
		}));
		clearSaveStatus();
	}

	function setCategoryPush(category, enabled) {
		const keys = activeKeysFor(category);
		setDraft((prev) => {
			const next = { ...prev };
			if (enabled) {
				const emailOn = keys.some((k) => prev[k] === 'email');
				keys.forEach((k) => {
					next[k] = emailOn ? 'email' : 'in_app';
				});
			} else {
				keys.forEach((k) => {
					next[k] = 'none';
				});
			}
			return next;
		});
		clearSaveStatus();
	}

	function setCategoryEmail(category, enabled) {
		const keys = activeKeysFor(category);
		setDraft((prev) => {
			const next = { ...prev };
			if (enabled) {
				keys.forEach((k) => {
					next[k] = 'email';
				});
			} else {
				keys.forEach((k) => {
					if (prev[k] === 'email') next[k] = 'in_app';
				});
			}
			return next;
		});
		clearSaveStatus();
	}

	function handleSave(e) {
		e.preventDefault();
		if (!isDirty) return;
		const patch = {};
		ALL_KEYS.forEach((key) => {
			if (data[key] !== draft[key]) patch[key] = draft[key];
		});
		if (Object.keys(patch).length === 0) return;
		mutate(patch);
	}

	function handleReset() {
		setDraft(data);
		clearSaveStatus();
	}

	const disabledActionStyle = { cursor: !isDirty || isPending ? 'not-allowed' : 'pointer' };

	return (
		<form onSubmit={handleSave} className="flex flex-col gap-[26px]">
			<div className="flex flex-col gap-[8px]">
				<h2 className="m-0 font-heading text-[20px] font-medium leading-[24px] tracking-normal text-text-strong">
					Notification Preference
				</h2>
				<p className="m-0 text-[14px] font-normal leading-[20px] tracking-normal text-text-secondary">
					Choose how and when you&apos;d like to be notified about activity on your films, account security,
					and discussions, so you stay informed without unnecessary noise.
				</p>
			</div>

			{PREFERENCE_CATEGORIES.map((category, idx) => {
				const keys = activeKeysFor(category);
				const pushOn = keys.length > 0 ? keys.some((k) => draft[k] !== 'none') : true;
				const emailOn = keys.length > 0 ? keys.some((k) => draft[k] === 'email') : true;
				const isCategoryInteractive = keys.length > 0;

				return (
					<React.Fragment key={category.id}>
						{idx > 0 && <div className="h-px bg-border-subtle" aria-hidden="true" />}
						<fieldset className="m-0 flex flex-col gap-[8px] border-0 p-0">
							<legend className="mb-0 p-0 text-[16px] font-normal leading-[24px] tracking-normal text-text-primary">
								{category.title}
							</legend>
							{category.items.map((item) => {
								const isActive = item.status === 'active' && item.key;
								const checked = isActive ? draft[item.key] !== 'none' : true;
								return (
									<div
										key={item.label}
										className="flex min-h-[24px] items-center justify-between gap-3 pb-[1.3px] pt-[2.5px]"
									>
										<span className="text-[14px] font-normal leading-[20px] tracking-normal text-text-secondary">
											{item.label}
										</span>
										{isActive ? (
											<Switch
												aria-label={item.label}
												checked={checked}
												disabled={isPending}
												className="opacity-100"
												onChange={(e) => setEventEnabled(item.key, e.target.checked, emailOn)}
											/>
										) : (
											<ComingSoonPill />
										)}
									</div>
								);
							})}
							<div className="flex min-h-[24px] items-center justify-between gap-3 pb-[1.3px] pt-[2.5px]">
								<span className="text-[14px] font-normal leading-[20px] tracking-normal text-text-secondary">
									Push notification
								</span>
								{isCategoryInteractive ? (
									<Switch
										aria-label={`${category.title} push notifications`}
										checked={pushOn}
										disabled={isPending}
										className="opacity-100"
										onChange={(e) => setCategoryPush(category, e.target.checked)}
									/>
								) : (
									<ComingSoonPill />
								)}
							</div>
							<div className="flex min-h-[24px] items-center justify-between gap-3 pb-[1.3px] pt-[2.5px]">
								<span className="text-[14px] font-normal leading-[20px] tracking-normal text-text-secondary">
									Email Notification
								</span>
								{isCategoryInteractive ? (
									<Switch
										aria-label={`${category.title} email notifications`}
										checked={emailOn}
										disabled={isPending}
										className="opacity-100"
										onChange={(e) => setCategoryEmail(category, e.target.checked)}
									/>
								) : (
									<ComingSoonPill />
								)}
							</div>
						</fieldset>
					</React.Fragment>
				);
			})}

			<div
				className={`items-center justify-end gap-3 pt-2 ${isDirty || isSaveError || isSuccess ? 'flex' : 'hidden'}`}
			>
				{isSaveError && (
					<span className="mr-auto text-xs text-text-danger">{saveError?.message ?? 'Save failed'}</span>
				)}
				{isSuccess && !isDirty && <span className="mr-auto text-xs text-text-secondary">Saved</span>}
				<button
					type="button"
					onClick={handleReset}
					disabled={!isDirty || isPending}
					className="border-0 bg-transparent p-0 text-sm text-text-link hover:text-text-link-hover hover:underline disabled:opacity-40"
					style={disabledActionStyle}
				>
					Reset
				</button>
				<button
					type="submit"
					disabled={!isDirty || isPending}
					className="transition-all disabled:opacity-40"
					style={{
						padding: '6px 18px',
						border: 'none',
						fontSize: '13px',
						fontWeight: 500,
						borderRadius: 'var(--radius-4)',
						backgroundColor: 'var(--bg-primary)',
						color: 'var(--text-on-primary)',
						boxShadow: 'none',
						...disabledActionStyle,
					}}
				>
					{isPending ? 'Saving…' : 'Save changes'}
				</button>
			</div>
		</form>
	);
}

function isDirtyState(draft, data) {
	if (!draft || !data) return false;
	return !arePrefsEqual(draft, data);
}
