import React from 'react';

import PageStore from '../../../../static/js/pages/_PageStore.js';
import { formatBytes } from '../../../shared/utils/formatBytes.js';

function isValidUsage(value) {
	return Number.isFinite(value) && value >= 0;
}

function resolveStorageConfig(usedBytes, scope) {
	if (usedBytes !== undefined || scope !== undefined) {
		return {
			usedBytes,
			scope: scope || 'site',
		};
	}

	return PageStore.get('config-storage') || {};
}

export function StorageUsage({ usedBytes, scope } = {}) {
	const storage = resolveStorageConfig(usedBytes, scope);
	const resolvedScope = storage.scope === 'user' ? 'user' : 'site';
	const resolvedUsedBytes = Number(storage.usedBytes);
	const label = resolvedScope === 'user' ? 'Your Usage' : 'Storage Hosted';

	if (storage.usedBytes === undefined) {
		return (
			<div className="flex flex-col gap-2" aria-label={`${label} loading`}>
				<div className="flex items-baseline justify-between gap-3">
					<span className="body-body-12-regular text-text-muted">{label}</span>
					<span className="h-3 w-14 rounded-full bg-bg-surface-muted" aria-hidden="true" />
				</div>
				<div className="h-2 w-full rounded-full bg-bg-skeleton" />
			</div>
		);
	}

	if (storage.usedBytes === null || storage.usedBytes === '' || !isValidUsage(resolvedUsedBytes)) {
		return (
			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between gap-3">
					<span className="body-body-12-regular text-text-muted">{label}</span>
					<span className="body-body-12-medium shrink-0 text-text-muted">Unavailable</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between gap-3">
				<span className="body-body-12-regular min-w-0 text-text-muted">{label}</span>
				<span className="body-body-12-medium shrink-0 text-text-strong">{formatBytes(resolvedUsedBytes)}</span>
			</div>
			<div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-bg-skeleton">
				<div
					className="h-full w-full rounded-full bg-bg-success"
					style={{
						backgroundImage:
							'repeating-linear-gradient(135deg, var(--bg-success) 0, var(--bg-success) 6px, var(--bg-success-strong) 6px, var(--bg-success-strong) 12px)',
					}}
				/>
			</div>
		</div>
	);
}
