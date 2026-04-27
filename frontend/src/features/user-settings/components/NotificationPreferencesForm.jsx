import React, { useEffect, useState } from 'react';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { useUpdateNotificationPreferences } from '../hooks/useUpdateNotificationPreferences';
import '../../../static/css/tailwind.css';

// Status drives the row's control slot: `active` shows an editable dropdown,
// `coming_soon` shows a read-only badge, `always_on` shows a static label.
const NOTIFICATION_ROWS = [
	{
		key: 'on_comment',
		status: 'active',
		label: 'Comments on your films',
		description: 'New comments on your uploaded films.',
	},
	{
		key: 'on_like',
		status: 'active',
		label: 'Likes on your films',
		description: 'Likes received on your uploaded films.',
	},
	{
		key: 'on_reply',
		status: 'coming_soon',
		label: 'Replies to your comments',
		description: 'Replies to comments you have posted.',
	},
	{
		key: 'on_follow',
		status: 'coming_soon',
		label: 'New followers',
		description: 'When someone starts following your profile.',
	},
	{
		key: 'on_mention',
		status: 'coming_soon',
		label: 'Mentions',
		description: 'When someone mentions you (@username) in a comment.',
	},
	{
		key: 'on_new_media_from_following',
		status: 'coming_soon',
		label: 'New films from filmmakers you follow',
		description: 'A filmmaker you follow publishes a new film.',
	},
	{
		key: 'on_added_to_playlist',
		status: 'coming_soon',
		label: 'Added to a playlist',
		description: 'Your film is added to a public playlist.',
	},
	{
		key: 'platform_announcements',
		status: 'always_on',
		label: 'Platform announcements',
		description: 'Important updates from the Cinemata team.',
	},
];

const ACTIVE_KEYS = NOTIFICATION_ROWS.filter((r) => r.status === 'active').map((r) => r.key);

const CHANNEL_OPTIONS = [
	{ value: 'email', label: 'In-App + Email' },
	{ value: 'in_app', label: 'In-App Only' },
	{ value: 'none', label: 'Disabled' },
];

function arePrefsEqual(a, b) {
	if (!a || !b) return false;
	return ACTIVE_KEYS.every((key) => a[key] === b[key]);
}

function StatusPill({ children, tone = 'muted' }) {
	const toneClasses =
		tone === 'accent'
			? 'text-content-body/80 bg-surface-popup border-border-input'
			: 'text-content-body/60 bg-surface-popup border-border-input/60';
	return (
		<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${toneClasses}`}>
			{children}
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
		// Seed the draft only on initial load. Background refetches and
		// post-save cache updates must not overwrite unsaved edits — use
		// the Reset button to pull the latest server state if needed.
		if (data && draft === null) setDraft(data);
	}, [data, draft]);

	if (isLoading) {
		return <p className="px-4 py-8 text-sm text-center text-content-body/60">Loading…</p>;
	}

	if (isError) {
		return (
			<p className="px-4 py-8 text-sm text-center text-content-body/60">
				Failed to load preferences: {error?.message ?? 'unknown error'}
			</p>
		);
	}

	if (!draft) return null;

	const isDirty = !arePrefsEqual(draft, data);

	function handleChange(key, value) {
		setDraft((prev) => ({ ...prev, [key]: value }));
		if (isSuccess || isSaveError) reset();
	}

	function handleSave(e) {
		e.preventDefault();
		if (!isDirty) return;
		const patch = {};
		ACTIVE_KEYS.forEach((key) => {
			if (data[key] !== draft[key]) patch[key] = draft[key];
		});
		if (Object.keys(patch).length === 0) return;
		mutate(patch);
	}

	function handleReset() {
		setDraft(data);
		if (isSuccess || isSaveError) reset();
	}

	// Global _buttons.scss forces `cursor: pointer` on `button` and
	// `cursor: default` on `button:disabled`, which beats Tailwind's
	// `disabled:cursor-not-allowed` utility. Inline styles win.
	const disabledActionStyle = { cursor: !isDirty || isPending ? 'not-allowed' : 'pointer' };

	function renderControl(row) {
		if (row.status === 'coming_soon') return <StatusPill>Coming soon</StatusPill>;
		if (row.status === 'always_on') return <StatusPill tone="accent">Always on</StatusPill>;
		return (
			<>
				<label className="sr-only" htmlFor={`pref-${row.key}`}>
					{row.label}
				</label>
				<select
					id={`pref-${row.key}`}
					value={draft[row.key] ?? 'in_app'}
					onChange={(e) => handleChange(row.key, e.target.value)}
					disabled={isPending}
					className="w-full sm:w-48 border border-border-input rounded px-3 py-2 text-sm text-content-body bg-surface-popup"
				>
					{CHANNEL_OPTIONS.map(({ value, label: optLabel }) => (
						<option key={value} value={value}>
							{optLabel}
						</option>
					))}
				</select>
			</>
		);
	}

	return (
		<form onSubmit={handleSave} className="space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-content-body">Notification Settings</h2>
				<p className="text-sm text-content-body/70 mt-1">Control what you hear about and how.</p>
			</div>

			<div className="bg-surface-popup rounded border border-border-input divide-y divide-border-input/40">
				{NOTIFICATION_ROWS.map((row) => {
					const dimmed = row.status !== 'active';
					return (
						<div
							key={row.key}
							className={`flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${
								dimmed ? 'opacity-75' : ''
							}`}
						>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-content-body">{row.label}</p>
								<p className="text-xs text-content-body/60 mt-0.5">{row.description}</p>
							</div>
							<div className="w-full sm:w-48 flex sm:justify-end">{renderControl(row)}</div>
						</div>
					);
				})}
			</div>

			<div className="flex items-center justify-end gap-3">
				{isSaveError && (
					<span className="text-xs text-red-500 mr-auto">{saveError?.message ?? 'Save failed'}</span>
				)}
				{isSuccess && !isDirty && <span className="text-xs text-content-body/60 mr-auto">Saved</span>}
				<button
					type="button"
					onClick={handleReset}
					disabled={!isDirty || isPending}
					className="border-0 bg-transparent p-0 text-sm text-content-link hover:underline disabled:opacity-40"
					style={disabledActionStyle}
				>
					Reset
				</button>
				{/* Inline styles on the save button are required because global
                    _buttons.scss overrides Tailwind @layer utilities for
                    background-color, color, padding, border-radius, font, and
                    cursor on all button elements (see NotificationPage.jsx). */}
				<button
					type="submit"
					disabled={!isDirty || isPending}
					className="transition-all disabled:opacity-40"
					style={{
						padding: '6px 18px',
						borderRadius: '9999px',
						border: 'none',
						fontSize: '13px',
						fontWeight: 500,
						backgroundColor: 'var(--btn-primary-bg-color)',
						color: '#fff',
						boxShadow: '0 1px 3px rgba(0,0,0,.2)',
						...disabledActionStyle,
					}}
				>
					{isPending ? 'Saving…' : 'Save changes'}
				</button>
			</div>
		</form>
	);
}
