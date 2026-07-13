import { useState } from 'react';
import { Button, Text, TextAlert, TextField } from '../../../shared/components';
import { apiFetch } from '../../../shared/utils/api';

const IDLE = 'idle';
const SENDING = 'sending';
const SUCCESS = 'success';
const ERROR = 'error';

export function ContactSection({ author }) {
	const [subject, setSubject] = useState('');
	const [body, setBody] = useState('');
	const [status, setStatus] = useState(IDLE);

	const recipientName = author.name || author.username;
	const canSubmit = status !== SENDING && subject.trim() !== '' && body.trim() !== '';

	// Clear a lingering success/error banner once the user starts a new message,
	// so it never sits above a half-typed follow-up.
	function clearStatusOnEdit() {
		if (status === SUCCESS || status === ERROR) setStatus(IDLE);
	}

	async function handleSubmit(event) {
		event.preventDefault();
		if (!canSubmit) return;

		setStatus(SENDING);
		try {
			const response = await apiFetch(`/api/v1/users/${encodeURIComponent(author.username)}/contact`, {
				method: 'POST',
				body: { subject: subject.trim(), body: body.trim() },
			});
			if (!response.ok) {
				setStatus(ERROR);
				return;
			}
			setSubject('');
			setBody('');
			setStatus(SUCCESS);
		} catch {
			setStatus(ERROR);
		}
	}

	return (
		<form className="flex max-w-2xl flex-col gap-4" onSubmit={handleSubmit} noValidate>
			<TextField
				label="Subject"
				name="subject"
				required
				value={subject}
				onChange={(event) => {
					setSubject(event.target.value);
					clearStatusOnEdit();
				}}
				className="w-full"
			/>

			<div className="field-shell w-full rounded px-0 pt-4 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-ring-focus">
				<label htmlFor="contact-message" className="body-body-16-regular mb-2 block">
					Message
					<span aria-hidden="true" className="text-text-danger">
						{' '}
						*
					</span>
				</label>
				<textarea
					id="contact-message"
					name="body"
					required
					rows={8}
					value={body}
					onChange={(event) => {
						setBody(event.target.value);
						clearStatusOnEdit();
					}}
					className="body-body-16-regular w-full resize-y border-0 bg-transparent text-text-strong outline-none placeholder:text-text-muted"
				/>
			</div>

			{status === SUCCESS ? (
				<TextAlert iconName="check">
					Your message was sent to {recipientName}. A copy is in your inbox.
				</TextAlert>
			) : null}
			{status === ERROR ? (
				<Text as="p" variant="body-14" className="m-0 text-text-danger" role="alert">
					Your message could not be sent. Please try again.
				</Text>
			) : null}

			<Button type="submit" variant="primary" disabled={!canSubmit} className="w-fit">
				{status === SENDING ? 'Sending…' : 'Send Message'}
			</Button>
		</form>
	);
}
