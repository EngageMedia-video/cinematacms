import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaReportButton } from './MediaReportButton';

const mocks = vi.hoisted(() => {
	const listeners = new Map();
	const state = { viewerReported: false };

	return {
		reportMedia: vi.fn(),
		retractMediaReport: vi.fn(),
		addNotification: vi.fn(),
		state,
		mediaPageStore: {
			get: vi.fn((key) => ('user-reported-media' === key ? state.viewerReported : null)),
			on: vi.fn((eventName, callback) => {
				listeners.set(eventName, [...(listeners.get(eventName) || []), callback]);
			}),
			removeListener: vi.fn((eventName, callback) => {
				listeners.set(
					eventName,
					(listeners.get(eventName) || []).filter((listener) => listener !== callback)
				);
			}),
			emit(eventName) {
				(listeners.get(eventName) || []).forEach((listener) => listener());
			},
		},
		reset() {
			listeners.clear();
			state.viewerReported = false;
			this.reportMedia.mockClear();
			this.retractMediaReport.mockClear();
			this.addNotification.mockClear();
		},
	};
});

vi.mock('../../../../static/js/pages/MediaPage/store.js', () => ({
	default: mocks.mediaPageStore,
}));

vi.mock('../../../../static/js/pages/MediaPage/actions.js', () => ({
	reportMedia: mocks.reportMedia,
	retractMediaReport: mocks.retractMediaReport,
}));

vi.mock('../../../../static/js/pages/_PageActions.js', () => ({
	addNotification: mocks.addNotification,
}));

async function openReportDialog() {
	await userEvent.click(screen.getAllByRole('button', { name: 'Report' })[0]);
}

async function openRetractDialog() {
	await userEvent.click(screen.getAllByRole('button', { name: 'Reported' })[0]);
}

async function submitDescription(text) {
	await userEvent.type(screen.getByLabelText('Description'), text);
	await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
}

describe('MediaReportButton', () => {
	beforeEach(() => {
		mocks.reset();
	});

	it('opens a form that asks for a description', async () => {
		render(<MediaReportButton />);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		await openReportDialog();

		expect(screen.getByRole('dialog', { name: 'Report film' })).toBeInTheDocument();
		expect(screen.getByLabelText('Description')).toHaveFocus();
	});

	it('asks for a description instead of sending an empty report', async () => {
		render(<MediaReportButton />);
		await openReportDialog();

		await submitDescription('   ');

		expect(mocks.reportMedia).not.toHaveBeenCalled();
		expect(screen.getByText('Enter a description.')).toBeInTheDocument();
		expect(screen.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
	});

	it('submits the trimmed description once while the report is pending', async () => {
		render(<MediaReportButton />);
		await openReportDialog();

		await submitDescription('  Shows a private address  ');

		expect(mocks.reportMedia).toHaveBeenCalledExactlyOnceWith('Shows a private address');
		expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
	});

	it('confirms a successful report and marks the media as reported', async () => {
		render(<MediaReportButton />);
		await openReportDialog();
		await submitDescription('Spam');

		act(() => mocks.mediaPageStore.emit('reported_media'));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(mocks.addNotification).toHaveBeenCalledExactlyOnceWith('Film reported', 'reportedMedia');
		expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Reported' })[0]).toHaveFocus();
	});

	it('keeps the form open with an error when the report fails, and allows a retry', async () => {
		render(<MediaReportButton />);
		await openReportDialog();
		await submitDescription('Spam');

		act(() => mocks.mediaPageStore.emit('media_report_failed'));

		expect(screen.getByRole('alert')).toHaveTextContent('The report could not be sent. Try again.');
		expect(screen.getByLabelText('Description')).toHaveValue('Spam');
		expect(mocks.addNotification).not.toHaveBeenCalled();

		await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect(mocks.reportMedia).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('clears the draft when the form is cancelled', async () => {
		render(<MediaReportButton />);
		await openReportDialog();
		await userEvent.type(screen.getByLabelText('Description'), 'Spam');

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		await openReportDialog();
		expect(screen.getByLabelText('Description')).toHaveValue('');
	});

	it('follows the report state of the media that is loaded', () => {
		mocks.state.viewerReported = true;
		render(<MediaReportButton />);
		expect(screen.getAllByRole('button', { name: 'Reported' })).toHaveLength(2);

		mocks.state.viewerReported = false;
		act(() => mocks.mediaPageStore.emit('loaded_media_data'));

		expect(screen.getAllByRole('button', { name: 'Report' })).toHaveLength(2);
	});

	it('asks for confirmation before retracting a report', async () => {
		mocks.state.viewerReported = true;
		render(<MediaReportButton />);

		await openRetractDialog();

		expect(screen.getByRole('dialog', { name: 'Withdraw report' })).toBeInTheDocument();
		expect(screen.getByText('Withdraw your report?')).toBeInTheDocument();
		expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
		expect(mocks.retractMediaReport).not.toHaveBeenCalled();
	});

	it('keeps the report when the viewer backs out of the confirmation', async () => {
		mocks.state.viewerReported = true;
		render(<MediaReportButton />);
		await openRetractDialog();

		await userEvent.click(screen.getByRole('button', { name: 'Keep report' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(mocks.retractMediaReport).not.toHaveBeenCalled();
		expect(screen.getAllByRole('button', { name: 'Reported' })).toHaveLength(2);
	});

	it('retracts the report once after the viewer confirms', async () => {
		mocks.state.viewerReported = true;
		render(<MediaReportButton />);
		await openRetractDialog();

		await userEvent.click(screen.getByRole('button', { name: 'Withdraw report' }));

		expect(mocks.retractMediaReport).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('button', { name: 'Withdrawing…' })).toBeDisabled();

		act(() => mocks.mediaPageStore.emit('media_report_retracted'));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(mocks.addNotification).toHaveBeenCalledExactlyOnceWith('Report withdrawn', 'reportRetracted');
		expect(screen.getAllByRole('button', { name: 'Report' })).toHaveLength(2);
	});

	it('keeps the confirmation open with an error when the retraction fails', async () => {
		mocks.state.viewerReported = true;
		render(<MediaReportButton />);
		await openRetractDialog();
		await userEvent.click(screen.getByRole('button', { name: 'Withdraw report' }));

		act(() => mocks.mediaPageStore.emit('media_report_retract_failed'));

		expect(screen.getByRole('alert')).toHaveTextContent('The report could not be withdrawn. Try again.');
		expect(mocks.addNotification).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog', { name: 'Withdraw report' })).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'Withdraw report' }));
		expect(mocks.retractMediaReport).toHaveBeenCalledTimes(2);
	});
});
