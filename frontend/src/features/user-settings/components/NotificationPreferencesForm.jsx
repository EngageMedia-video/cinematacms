import React, { useEffect, useState } from 'react';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { useUpdateNotificationPreferences } from '../hooks/useUpdateNotificationPreferences';
import '../../../static/css/tailwind.css';

const NOTIFICATION_TYPES = [
    {
        key: 'on_comment',
        label: 'Comments on your media',
        description: 'Someone leaves a comment on one of your uploads.',
    },
    {
        key: 'on_reply',
        label: 'Replies to your comments',
        description: 'Someone replies to a comment thread you started.',
    },
    {
        key: 'on_like',
        label: 'Likes on your media',
        description: 'Someone likes one of your uploads.',
    },
    {
        key: 'on_follow',
        label: 'New followers',
        description: 'Someone starts following your profile.',
    },
    {
        key: 'on_mention',
        label: 'Mentions',
        description: 'Someone mentions you (@username) in a comment.',
    },
    {
        key: 'on_new_media_from_following',
        label: 'New media from filmmakers you follow',
        description: 'A filmmaker you follow publishes new media.',
    },
    {
        key: 'on_added_to_playlist',
        label: 'Added to a playlist',
        description: 'Your media is added to a public playlist.',
    },
];

const CHANNEL_OPTIONS = [
    { value: 'email', label: 'In-App + Email' },
    { value: 'in_app', label: 'In-App Only' },
    { value: 'none', label: 'Disabled' },
];

function arePrefsEqual(a, b) {
    if (!a || !b) return false;
    return NOTIFICATION_TYPES.every(({ key }) => a[key] === b[key]);
}

export function NotificationPreferencesForm() {
    const { data, isLoading, isError, error } = useNotificationPreferences();
    const { mutate, isPending, isSuccess, isError: isSaveError, error: saveError, reset } =
        useUpdateNotificationPreferences();

    const [draft, setDraft] = useState(null);

    useEffect(() => {
        // Seed the draft only on initial load. Background refetches and
        // post-save cache updates must not overwrite unsaved edits — use
        // the Reset button to pull the latest server state if needed.
        if (data && draft === null) setDraft(data);
    }, [data, draft]);

    if (isLoading) {
        return (
            <p className="px-4 py-8 text-sm text-center text-content-body/60">Loading…</p>
        );
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
        NOTIFICATION_TYPES.forEach(({ key }) => {
            if (data[key] !== draft[key]) patch[key] = draft[key];
        });
        mutate(patch);
    }

    function handleReset() {
        setDraft(data);
        if (isSuccess || isSaveError) reset();
    }

    return (
        <form onSubmit={handleSave} className="bg-surface-popup rounded border border-border-input divide-y divide-border-input/40">
            {NOTIFICATION_TYPES.map(({ key, label, description }) => (
                <div
                    key={key}
                    className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-content-body">{label}</p>
                        <p className="text-xs text-content-body/60 mt-0.5">{description}</p>
                    </div>
                    <label className="sr-only" htmlFor={`pref-${key}`}>
                        {label}
                    </label>
                    <select
                        id={`pref-${key}`}
                        value={draft[key] ?? 'in_app'}
                        onChange={(e) => handleChange(key, e.target.value)}
                        disabled={isPending}
                        className="w-full sm:w-48 border border-border-input rounded px-3 py-2 text-sm text-content-body bg-surface-popup"
                    >
                        {CHANNEL_OPTIONS.map(({ value, label: optLabel }) => (
                            <option key={value} value={value}>
                                {optLabel}
                            </option>
                        ))}
                    </select>
                </div>
            ))}

            <div className="flex items-center justify-end gap-3 px-4 py-4">
                {isSaveError && (
                    <span className="text-xs text-red-500 mr-auto">
                        {saveError?.message ?? 'Save failed'}
                    </span>
                )}
                {isSuccess && !isDirty && (
                    <span className="text-xs text-content-body/60 mr-auto">Saved</span>
                )}
                <button
                    type="button"
                    onClick={handleReset}
                    disabled={!isDirty || isPending}
                    className="border-0 bg-transparent p-0 cursor-pointer text-sm text-content-link hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Reset
                </button>
                {/* Inline styles on the save button are required because global
                    _buttons.scss overrides Tailwind @layer utilities for
                    background-color, color, padding, border-radius and font on
                    all button elements (see NotificationPage.jsx). */}
                <button
                    type="submit"
                    disabled={!isDirty || isPending}
                    className="cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        padding: '6px 18px',
                        borderRadius: '9999px',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 500,
                        backgroundColor: 'var(--btn-primary-bg-color)',
                        color: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }}
                >
                    {isPending ? 'Saving…' : 'Save changes'}
                </button>
            </div>
        </form>
    );
}
