import { useState, useRef } from 'react';
import { Dialog } from '../Dialog';
import { DialogContent } from '../Dialog';
import { postRequest, getCSRFToken } from '../../../../static/js/functions';

export function PasswordDialog({ open, onOpenChange, friendlyToken, onSuccess, onClose }) {
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const inputRef = useRef(null);

	function handleSubmit(e) {
		e.preventDefault();
		if (!password || submitting) return;

		setSubmitting(true);
		setError('');

		const url = `/api/v1/media/${friendlyToken}/password`;

		postRequest(
			url,
			{ password },
			{ headers: { 'X-CSRFToken': getCSRFToken() } },
			true,
			(response) => {
				setSubmitting(false);
				if (response?.data?.token) {
					onSuccess(response.data.token);
				} else {
					setError('An error occurred. Please try again.');
				}
			},
			(err) => {
				setSubmitting(false);
				const status = err?.response?.status;
				const detail = err?.response?.data?.detail;

				if (status === 429) {
					setError(detail || 'Too many attempts. Please try again later.');
				} else if (status === 403) {
					setError(detail || 'Incorrect password.');
					setPassword('');
					inputRef.current?.focus();
				} else {
					setError('An error occurred. Please try again.');
				}
			}
		);
	}

	function handleOpenChange(nextOpen) {
		if (!nextOpen) {
			setPassword('');
			setError('');
			onClose?.();
		}
		onOpenChange?.(nextOpen);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				ariaLabel="Enter password to view media"
				className="max-w-[420px] min-w-[320px] bg-transparent p-0 text-left shadow-none"
			>
				<div className="relative overflow-hidden p-[26px] border-[0.5px] rounded-2xl border-cinemata-neutral-300 bg-linear-to-br from-cinemata-white to-cinemata-neutral-50 dark:border-cinemata-strait-blue-300 dark:from-cinemata-pacific-deep-900 dark:to-cinemata-pacific-deep-950">
					<form onSubmit={handleSubmit} className="relative z-10 flex flex-col">
						<div className="flex flex-col items-center text-center">
							<span className="material-icons text-[48px] text-cinemata-neutral-400 dark:text-cinemata-pacific-deep-300">
								lock
							</span>
							<h2 className="heading-h5-24-medium p-0 m-0 mt-4 text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50">
								Password Protected
							</h2>
							<p className="body-body-16-regular p-0 m-0 mt-2 text-cinemata-neutral-500 dark:text-cinemata-pacific-deep-300">
								Enter the password to view this media.
							</p>
						</div>

						{error ? (
							<div
								role="alert"
								className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-400"
							>
								{error}
							</div>
						) : null}

						<input
							ref={inputRef}
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Password"
							required
							autoFocus
							disabled={submitting}
							className="mt-6 w-full rounded-lg border border-cinemata-neutral-300 bg-cinemata-white px-4 py-3 text-base text-cinemata-neutral-900 outline-none placeholder:text-cinemata-neutral-400 focus:border-cinemata-strait-blue-500 focus:ring-1 focus:ring-cinemata-strait-blue-500 dark:border-cinemata-strait-blue-300 dark:bg-cinemata-pacific-deep-800 dark:text-cinemata-strait-blue-50 dark:placeholder:text-cinemata-pacific-deep-400 dark:focus:border-cinemata-strait-blue-400 dark:focus:ring-cinemata-strait-blue-400"
						/>

						<div className="mt-6 flex justify-end gap-3">
							<Dialog.Close>
								<button
									type="button"
									className="rounded-lg border border-cinemata-neutral-300 bg-transparent px-5 py-2.5 text-sm font-medium text-cinemata-neutral-700 transition-colors hover:bg-cinemata-neutral-100 dark:border-cinemata-strait-blue-300 dark:text-cinemata-strait-blue-100 dark:hover:bg-cinemata-pacific-deep-800"
								>
									Cancel
								</button>
							</Dialog.Close>
							<button
								type="submit"
								disabled={submitting || !password}
								className="rounded-lg bg-cinemata-strait-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cinemata-strait-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cinemata-strait-blue-500 dark:hover:bg-cinemata-strait-blue-400"
							>
								{submitting ? 'Verifying...' : 'Submit'}
							</button>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
