import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactSection } from './ContactSection';

const AUTHOR = { username: 'jen', name: 'Jen Tarnate' };

describe('ContactSection', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('disables submit until both fields are filled', () => {
		render(<ContactSection author={AUTHOR} />);

		const submit = screen.getByRole('button', { name: /send message/i });
		expect(submit).toBeDisabled();

		fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Hello' } });
		expect(submit).toBeDisabled();

		fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'A question' } });
		expect(submit).not.toBeDisabled();
	});

	it('posts the message to the contact endpoint and shows success', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) });

		render(<ContactSection author={AUTHOR} />);
		fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Hello' } });
		fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'A question' } });
		fireEvent.click(screen.getByRole('button', { name: /send message/i }));

		await waitFor(() => expect(screen.getByText(/your message was sent to jen/i)).toBeInTheDocument());

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/users/jen/contact');
		expect(options.method).toBe('POST');
		expect(JSON.parse(options.body)).toEqual({ subject: 'Hello', body: 'A question' });
	});

	it('shows an error when the request fails', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, json: async () => ({}) });

		render(<ContactSection author={AUTHOR} />);
		fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Hello' } });
		fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'A question' } });
		fireEvent.click(screen.getByRole('button', { name: /send message/i }));

		await waitFor(() => expect(screen.getByText(/could not be sent/i)).toBeInTheDocument());
	});
});
