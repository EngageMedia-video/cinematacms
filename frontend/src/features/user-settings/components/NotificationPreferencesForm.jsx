import React, { useEffect, useMemo, useState } from 'react';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { useUpdateNotificationPreferences } from '../hooks/useUpdateNotificationPreferences';

const PREFERENCE_CATEGORIES = [
	{
		id: 'engagement',
		title: 'Engagement & Discussions',
		items: [
			{ key: 'on_comment', label: 'New comment on your film', status: 'active' },
			{ label: 'Replies to your comment', status: 'coming_soon' },
			{ key: 'on_like', label: 'New reactions to your film', status: 'active' },
		],
	},
	{
		id: 'upload',
		title: 'Upload & Archive Updates',
		items: [
			{ label: 'Upload completed', status: 'coming_soon' },
			{ label: 'Upload failed', status: 'coming_soon' },
			{ label: 'Processing completed', status: 'coming_soon' },
			{ label: 'Scheduled visibility change', status: 'coming_soon' },
			{ label: 'New films from filmmakers you follow', status: 'coming_soon' },
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
			{ label: 'Request for screening or usage', status: 'coming_soon' },
		],
	},
];

const ALL_KEYS = PREFERENCE_CATEGORIES.flatMap((cat) =>
	cat.items.filter((i) => i.status === 'active' && i.key).map((i) => i.key)
);

const CHANNEL_OPTIONS = [
	{ value: 'none', label: 'Off' },
	{ value: 'in_app', label: 'App', ariaLabel: 'In-App' },
	{ value: 'email', label: 'Email', ariaLabel: 'In-App + Email' },
];

function arePrefsEqual(a, b) {
	if (!a || !b) return false;
	return ALL_KEYS.every((key) => a[key] === b[key]);
}

function ComingSoonPill() {
	return (
		<span className="inline-flex min-h-[24px] items-center rounded-full bg-bg-surface-muted px-3 text-[11px] font-medium leading-[14px] tracking-normal text-text-muted">
			Coming soon
		</span>
	);
}

function ChannelSegmentedControl({ disabled, label, value, onChange }) {
	return (
		<div
			role="group"
			aria-label={`${label} notification channel`}
			className="grid w-[140px] max-w-full grid-cols-[0.7fr_0.75fr_1fr] overflow-hidden rounded-full border border-border-default bg-bg-surface-muted p-0.5"
		>
			{CHANNEL_OPTIONS.map((option) => {
				const isSelected = value === option.value;

				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={isSelected}
						aria-label={option.ariaLabel ?? option.label}
						disabled={disabled}
						onClick={() => onChange(option.value)}
						className={`min-h-[24px] min-w-0 rounded-full border-0 px-1.5 text-[11px] font-medium leading-[14px] tracking-normal transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-bg-surface disabled:cursor-not-allowed disabled:opacity-60 ${
							isSelected
								? 'bg-bg-primary text-text-on-primary'
								: 'bg-transparent text-text-secondary hover:bg-bg-surface hover:text-text-primary'
						}`}
					>
						<span className="block truncate">{option.label}</span>
					</button>
				);
			})}
		</div>
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

	function setPreferenceChannel(key, channel) {
		setDraft((prev) => ({
			...prev,
			[key]: channel,
		}));
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

	return (
		<form onSubmit={handleSave} className="flex flex-col gap-[26px]">
			<div className="flex flex-col gap-[8px]">
				<h2 className="m-0 font-heading text-[20px] font-medium leading-[24px] tracking-normal text-text-strong">
					Notification Preference
				</h2>
				<p className="m-0 text-[14px] font-normal leading-[20px] tracking-normal text-text-secondary">
					Choose how and when you&apos;d like to be notified about activity on your films and discussions, so
					you stay informed without unnecessary noise.
				</p>
			</div>

			{PREFERENCE_CATEGORIES.map((category, idx) => {
				return (
					<React.Fragment key={category.id}>
						{idx > 0 && <div className="h-px bg-border-subtle" aria-hidden="true" />}
						<fieldset className="m-0 flex flex-col gap-[8px] border-0 p-0">
							<legend className="mb-0 p-0 text-[16px] font-normal leading-[24px] tracking-normal text-text-primary">
								{category.title}
							</legend>
							{category.items.map((item) => {
								const isActive = item.status === 'active' && item.key;
								return (
									<div
										key={item.label}
										className="grid min-h-[24px] min-w-0 grid-cols-1 gap-2 pb-[1.3px] pt-[2.5px] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
									>
										<span className="min-w-0 whitespace-nowrap text-[13px] font-normal leading-[20px] tracking-normal text-text-secondary">
											{item.label}
										</span>
										{isActive ? (
											<ChannelSegmentedControl
												label={item.label}
												value={draft[item.key]}
												disabled={isPending}
												onChange={(channel) => setPreferenceChannel(item.key, channel)}
											/>
										) : (
											<ComingSoonPill />
										)}
									</div>
								);
							})}
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
					className="border-0 bg-transparent p-0 text-sm text-text-link hover:text-text-link-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface disabled:cursor-not-allowed disabled:opacity-40"
				>
					Reset
				</button>
				<button
					type="submit"
					disabled={!isDirty || isPending}
					className="rounded-ds-4 border-0 bg-bg-primary px-[18px] py-[6px] text-[13px] font-medium leading-5 tracking-normal text-text-on-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface disabled:cursor-not-allowed disabled:opacity-40"
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
