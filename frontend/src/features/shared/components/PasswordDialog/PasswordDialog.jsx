import { useState, useRef } from 'react';
import { postRequest, getCSRFToken } from '../../../../static/js/functions';
import cornerDecoration from '../ConfirmationDialog/assets/confirmation-corner.webp';

export function PasswordDialog({ friendlyToken, ownerName, ownerUrl, onSuccess }) {
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
					setError(detail || 'The password is incorrect.');
					setPassword('');
					inputRef.current?.focus();
				} else {
					setError('An error occurred. Please try again.');
				}
			}
		);
	}

	return (
		<div className="password-dialog-card">
			<img src={cornerDecoration} alt="" aria-hidden="true" className="password-dialog-decoration" />

			<form onSubmit={handleSubmit} className="password-dialog-content">
				<span className="material-icons password-dialog-icon">lock</span>

				<h2 className="password-dialog-title">Enter Password to Access.</h2>

				<p className="password-dialog-subtitle">
					{ownerName ? (
						<>
							{'If you don’t have access, please reach out to '}
							{ownerUrl ? (
								<a href={ownerUrl} className="password-dialog-owner-link">
									{ownerName}
								</a>
							) : (
								<strong>{ownerName}</strong>
							)}
							{' via their About page to request access.'}
						</>
					) : (
						'Enter the password to view this media.'
					)}
				</p>

				{error ? (
					<div role="alert" className="password-dialog-error">
						{error}
					</div>
				) : null}

				<div className="password-dialog-form-row">
					<input
						ref={inputRef}
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Enter Password"
						disabled={submitting}
						className="password-dialog-input"
					/>
					<button type="submit" disabled={submitting || !password} className="password-dialog-unlock">
						{submitting ? 'Verifying...' : 'UNLOCK'}
					</button>
				</div>
			</form>
		</div>
	);
}
