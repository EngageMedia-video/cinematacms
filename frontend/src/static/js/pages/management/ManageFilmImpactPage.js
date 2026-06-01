import React from 'react';
import PropTypes from 'prop-types';

import ApiUrlContext from '../../contexts/ApiUrlContext';
import getCSRFToken from '../../functions/getCSRFToken';

import { Page } from '../_Page';
import { MediaListWrapper } from '../components/MediaListWrapper';

import '../styles/ManageFilmImpactPage.scss';

const CATEGORY_OPTIONS = [
	{ value: '', label: 'All categories' },
	{ value: 'screening', label: 'Screened In' },
	{ value: 'featured', label: 'Featured In' },
	{ value: 'saves', label: 'Saves & Playlists' },
	{ value: 'academic', label: 'Academic Usage' },
	{ value: 'curated', label: 'Curated Into' },
];

const EDIT_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter((option) =>
	['screening', 'featured', 'academic'].includes(option.value)
);

const STATUS_OPTIONS = [
	{ value: '', label: 'All statuses' },
	{ value: 'pending', label: 'Pending' },
	{ value: 'active', label: 'Active' },
	{ value: 'inactive', label: 'Inactive' },
];

const EDIT_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) => option.value);

const EDIT_PATH_PATTERN = /\/manage\/film-impact\/([^/]+)\/edit\/?$/;

function appendQuery(url, params) {
	const query = Object.keys(params)
		.filter((key) => params[key])
		.map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
		.join('&');

	return url + (query ? '?' + query : '');
}

function formatDate(value, withTime) {
	if (!value) {
		return '-';
	}

	if (!withTime && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return value;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

function userLabel(user) {
	if (!user) {
		return '-';
	}

	return user.name || user.username || '-';
}

function statusLabel(status) {
	const option = STATUS_OPTIONS.find((item) => item.value === status);
	return option ? option.label : status || '-';
}

function nextStatus(status) {
	return status === 'active' ? 'inactive' : 'active';
}

function statusActionLabel(status) {
	return status === 'active' ? 'Deactivate' : 'Activate';
}

function statusButtonClassName(status) {
	return status === 'active'
		? 'manage-film-impact-page__button manage-film-impact-page__button--secondary'
		: 'manage-film-impact-page__button manage-film-impact-page__button--primary';
}

function editUidFromPath() {
	const match = window.location.pathname.match(EDIT_PATH_PATTERN);
	return match ? match[1] : null;
}

function manageFilmImpactPageUrl() {
	return window.MediaCMS && window.MediaCMS.url && window.MediaCMS.url.manageFilmImpact
		? window.MediaCMS.url.manageFilmImpact
		: '/manage/film-impact';
}

export class ManageFilmImpactPage extends Page {
	constructor(props) {
		super(props, 'manage-film-impact');

		const editUid = editUidFromPath();

		this.state = {
			editUid,
			form: null,
			formErrors: null,
			saveMessage: null,
			items: [],
			resultsCount: null,
			currentPage: 1,
			search: '',
			category: '',
			status: '',
			loading: false,
			error: null,
			deletingUid: null,
			changingStatusUid: null,
			next: null,
			previous: null,
		};

		this.onSearchChange = this.onSearchChange.bind(this);
		this.onCategoryChange = this.onCategoryChange.bind(this);
		this.onStatusChange = this.onStatusChange.bind(this);
		this.onSubmitFilters = this.onSubmitFilters.bind(this);
		this.onPreviousPage = this.onPreviousPage.bind(this);
		this.onNextPage = this.onNextPage.bind(this);
		this.onFormFieldChange = this.onFormFieldChange.bind(this);
		this.onDeleteEdit = this.onDeleteEdit.bind(this);
		this.onSubmitEdit = this.onSubmitEdit.bind(this);
		this.onDeleteListItem = this.onDeleteListItem.bind(this);
		this.onStatusListItem = this.onStatusListItem.bind(this);
	}

	componentDidMount() {
		if (this.state.editUid) {
			this.loadEditItem();
			return;
		}

		this.loadItems(this.buildRequestUrl(1), 1);
	}

	buildRequestUrl(page) {
		return appendQuery(ApiUrlContext._currentValue.manage.filmImpact, {
			search: this.state.search.trim(),
			category: this.state.category,
			status: this.state.status,
			page,
		});
	}

	loadItems(requestUrl, page) {
		this.setState({ loading: true, error: null });

		fetch(requestUrl, { credentials: 'same-origin', cache: 'no-store' })
			.then((response) => {
				if (!response.ok) {
					throw new Error('Unable to load film impact entries.');
				}
				return response.json();
			})
			.then((data) => {
				this.setState({
					items: data.results || [],
					resultsCount: data.count,
					currentPage: page,
					next: data.next,
					previous: data.previous,
					loading: false,
				});
			})
			.catch((error) => {
				this.setState({
					error: error.message,
					loading: false,
				});
			});
	}

	loadEditItem() {
		this.setState({ loading: true, error: null, formErrors: null, saveMessage: null });

		fetch(ApiUrlContext._currentValue.manage.filmImpact + '/' + this.state.editUid, {
			credentials: 'same-origin',
			cache: 'no-store',
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error('Unable to load film impact entry.');
				}
				return response.json();
			})
			.then((data) => {
				this.setState({
					form: {
						title: data.title || '',
						category: data.category || 'screening',
						details: data.details || '',
						status: data.status || 'pending',
						event_date: data.event_date || '',
						url: data.url || '',
						media: data.media || null,
						user: data.user || null,
					},
					loading: false,
				});
			})
			.catch((error) => {
				this.setState({
					error: error.message,
					loading: false,
				});
			});
	}

	onSearchChange(ev) {
		this.setState({ search: ev.currentTarget.value });
	}

	onCategoryChange(ev) {
		this.setState({ category: ev.currentTarget.value });
	}

	onStatusChange(ev) {
		this.setState({ status: ev.currentTarget.value });
	}

	onSubmitFilters(ev) {
		ev.preventDefault();
		this.loadItems(this.buildRequestUrl(1), 1);
	}

	onPreviousPage() {
		if (this.state.previous) {
			this.loadItems(this.state.previous, Math.max(1, this.state.currentPage - 1));
		}
	}

	onNextPage() {
		if (this.state.next) {
			this.loadItems(this.state.next, this.state.currentPage + 1);
		}
	}

	onFormFieldChange(ev) {
		const field = ev.currentTarget.name;
		const value = ev.currentTarget.value;

		this.setState({
			form: {
				...this.state.form,
				[field]: value,
			},
			saveMessage: null,
		});
	}

	onSubmitEdit(ev) {
		ev.preventDefault();
		this.setState({ loading: true, error: null, formErrors: null, saveMessage: null });

		fetch(ApiUrlContext._currentValue.manage.filmImpact + '/' + this.state.editUid, {
			method: 'PATCH',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': getCSRFToken(),
			},
			body: JSON.stringify({
				title: this.state.form.title,
				category: this.state.form.category,
				details: this.state.form.details,
				status: this.state.form.status,
				event_date: this.state.form.event_date,
				url: this.state.form.url,
			}),
		})
			.then((response) => {
				if (!response.ok) {
					return response.json().then((data) => {
						const error = new Error('Unable to save film impact entry.');
						error.formErrors = data;
						throw error;
					});
				}
				return response.json();
			})
			.then((data) => {
				this.setState({
					form: {
						title: data.title || '',
						category: data.category || 'screening',
						details: data.details || '',
						status: data.status || 'pending',
						event_date: data.event_date || '',
						url: data.url || '',
						media: data.media || null,
						user: data.user || null,
					},
					saveMessage: 'Film impact entry saved.',
					loading: false,
				});
			})
			.catch((error) => {
				this.setState({
					error: error.message,
					formErrors: error.formErrors || null,
					saveMessage: null,
					loading: false,
				});
			});
	}

	deleteItem(uid) {
		return fetch(ApiUrlContext._currentValue.manage.filmImpact + '/' + uid, {
			method: 'DELETE',
			credentials: 'same-origin',
			headers: {
				'X-CSRFToken': getCSRFToken(),
			},
		}).then((response) => {
			if (!response.ok) {
				throw new Error('Unable to delete film impact entry.');
			}
		});
	}

	onDeleteEdit() {
		if (!window.confirm('Delete this film impact entry?')) {
			return;
		}

		this.setState({ loading: true, error: null });

		this.deleteItem(this.state.editUid)
			.then(() => {
				window.location.href = manageFilmImpactPageUrl();
			})
			.catch((error) => {
				this.setState({
					error: error.message,
					loading: false,
				});
			});
	}

	onDeleteListItem(uid) {
		if (!window.confirm('Delete this film impact entry?')) {
			return;
		}

		this.setState({ deletingUid: uid, error: null });

		this.deleteItem(uid)
			.then(() => {
				this.setState({
					items: this.state.items.filter((item) => item.uid !== uid),
					resultsCount: null === this.state.resultsCount ? null : Math.max(0, this.state.resultsCount - 1),
					deletingUid: null,
				});
			})
			.catch((error) => {
				this.setState({
					error: error.message,
					deletingUid: null,
				});
			});
	}

	onStatusListItem(uid, status) {
		this.setState({ changingStatusUid: uid, error: null });

		fetch(ApiUrlContext._currentValue.manage.filmImpact + '/' + uid, {
			method: 'PATCH',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': getCSRFToken(),
			},
			body: JSON.stringify({ status }),
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error('Unable to update film impact status.');
				}
				return response.json();
			})
			.then((data) => {
				const shouldRemove = this.state.status && data.status !== this.state.status;
				this.setState({
					items: shouldRemove
						? this.state.items.filter((item) => item.uid !== data.uid)
						: this.state.items.map((item) => (item.uid === data.uid ? data : item)),
					resultsCount:
						shouldRemove && null !== this.state.resultsCount
							? Math.max(0, this.state.resultsCount - 1)
							: this.state.resultsCount,
					changingStatusUid: null,
				});
			})
			.catch((error) => {
				this.setState({
					error: error.message,
					changingStatusUid: null,
				});
			});
	}

	renderFieldError(field) {
		if (!this.state.formErrors || !this.state.formErrors[field]) {
			return null;
		}

		return <span className="manage-film-impact-page__field-error">{this.state.formErrors[field].join(' ')}</span>;
	}

	renderEditForm() {
		if (this.state.loading && !this.state.form) {
			return (
				<MediaListWrapper
					title="Edit film impact"
					className="search-results-wrap items-list-hor manage-film-impact-page"
				>
					<p>Loading film impact entry...</p>
				</MediaListWrapper>
			);
		}

		if (this.state.error && !this.state.form) {
			return (
				<MediaListWrapper
					title="Edit film impact"
					className="search-results-wrap items-list-hor manage-film-impact-page"
				>
					<p>{this.state.error}</p>
				</MediaListWrapper>
			);
		}

		if (!this.state.form) {
			return null;
		}

		return (
			<MediaListWrapper
				title="Edit film impact"
				className="search-results-wrap items-list-hor manage-film-impact-page"
			>
				<form className="manage-film-impact-page__edit-form" onSubmit={this.onSubmitEdit}>
					<div className="manage-film-impact-page__meta">
						<span>Media: {this.state.form.media ? this.state.form.media.title : '-'}</span>
						<span>Submitted by: {userLabel(this.state.form.user)}</span>
					</div>

					<label>
						<span>Title</span>
						<input
							type="text"
							name="title"
							value={this.state.form.title}
							onChange={this.onFormFieldChange}
							required
						/>
						{this.renderFieldError('title')}
					</label>

					<label>
						<span>Category</span>
						<select name="category" value={this.state.form.category} onChange={this.onFormFieldChange}>
							{EDIT_CATEGORY_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						{this.renderFieldError('category')}
					</label>

					<label>
						<span>Details</span>
						<textarea
							name="details"
							value={this.state.form.details}
							onChange={this.onFormFieldChange}
							rows="5"
						/>
						{this.renderFieldError('details')}
					</label>

					<label>
						<span>Status</span>
						<select name="status" value={this.state.form.status} onChange={this.onFormFieldChange}>
							{EDIT_STATUS_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						{this.renderFieldError('status')}
					</label>

					<label>
						<span>Event date</span>
						<input
							type="date"
							name="event_date"
							value={this.state.form.event_date}
							onChange={this.onFormFieldChange}
							required
						/>
						{this.renderFieldError('event_date')}
					</label>

					<label>
						<span>URL</span>
						<input type="url" name="url" value={this.state.form.url} onChange={this.onFormFieldChange} />
						{this.renderFieldError('url')}
					</label>

					{this.state.error && this.state.formErrors ? (
						<p className="manage-film-impact-page__error">{this.state.error}</p>
					) : null}
					{this.state.saveMessage ? (
						<p className="manage-film-impact-page__success" aria-live="polite">
							{this.state.saveMessage}
						</p>
					) : null}

					<div className="manage-film-impact-page__form-actions">
						<button
							type="button"
							className="manage-film-impact-page__button manage-film-impact-page__button--danger"
							onClick={this.onDeleteEdit}
							disabled={this.state.loading}
						>
							Delete
						</button>
						<a
							className="manage-film-impact-page__button manage-film-impact-page__button--secondary"
							href={manageFilmImpactPageUrl()}
						>
							Cancel
						</a>
						<button
							type="submit"
							className="manage-film-impact-page__button manage-film-impact-page__button--primary"
							disabled={this.state.loading}
						>
							{this.state.loading ? 'Saving...' : 'Save'}
						</button>
					</div>
				</form>
			</MediaListWrapper>
		);
	}

	renderRows() {
		if (this.state.loading) {
			return (
				<tr>
					<td colSpan="8">Loading film impact entries...</td>
				</tr>
			);
		}

		if (this.state.error) {
			return (
				<tr>
					<td colSpan="8">{this.state.error}</td>
				</tr>
			);
		}

		if (!this.state.items.length) {
			return (
				<tr>
					<td colSpan="8">No film impact entries found.</td>
				</tr>
			);
		}

		return this.state.items.map((item) => (
			<tr key={item.uid}>
				<td>
					<a href={item.edit_url}>{item.title}</a>
				</td>
				<td>{item.category_label || item.category}</td>
				<td>
					<span className={'manage-film-impact-page__status manage-film-impact-page__status--' + item.status}>
						{item.status_label || statusLabel(item.status)}
					</span>
				</td>
				<td>{item.media ? <a href={item.media.url}>{item.media.title}</a> : '-'}</td>
				<td>{userLabel(item.user)}</td>
				<td>{formatDate(item.event_date, false)}</td>
				<td>{formatDate(item.add_date, true)}</td>
				<td>
					<button
						type="button"
						className={statusButtonClassName(item.status)}
						onClick={() => this.onStatusListItem(item.uid, nextStatus(item.status))}
						disabled={this.state.changingStatusUid === item.uid}
					>
						{this.state.changingStatusUid === item.uid ? 'Updating...' : statusActionLabel(item.status)}
					</button>
					<a className="manage-film-impact-page__action" href={item.edit_url}>
						Edit
					</a>
					<button
						type="button"
						className="manage-film-impact-page__action manage-film-impact-page__action-button manage-film-impact-page__danger"
						onClick={() => this.onDeleteListItem(item.uid)}
						disabled={this.state.deletingUid === item.uid}
					>
						{this.state.deletingUid === item.uid ? 'Deleting...' : 'Delete'}
					</button>
				</td>
			</tr>
		));
	}

	pageContent() {
		if (this.state.editUid) {
			return this.renderEditForm();
		}

		return (
			<MediaListWrapper
				title={
					this.props.title + (null === this.state.resultsCount ? '' : ' (' + this.state.resultsCount + ')')
				}
				className="search-results-wrap items-list-hor manage-film-impact-page"
			>
				<form className="manage-film-impact-page__filters" onSubmit={this.onSubmitFilters}>
					<input
						type="search"
						value={this.state.search}
						onChange={this.onSearchChange}
						aria-label="Search film impact entries"
						placeholder="Search title, details, film, or user"
					/>
					<select
						value={this.state.category}
						onChange={this.onCategoryChange}
						aria-label="Filter by film impact category"
					>
						{CATEGORY_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<select
						value={this.state.status}
						onChange={this.onStatusChange}
						aria-label="Filter by film impact status"
					>
						{STATUS_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<button
						type="submit"
						className="manage-film-impact-page__button manage-film-impact-page__button--primary"
					>
						Search
					</button>
				</form>

				<div className="manage-film-impact-page__table-wrap">
					<table className="manage-film-impact-page__table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Category</th>
								<th>Status</th>
								<th>Media</th>
								<th>Submitted by</th>
								<th>Event date</th>
								<th>Added</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>{this.renderRows()}</tbody>
					</table>
				</div>

				<div className="manage-film-impact-page__pagination">
					<button
						type="button"
						className="manage-film-impact-page__button manage-film-impact-page__button--secondary"
						onClick={this.onPreviousPage}
						disabled={!this.state.previous}
						aria-label="Previous film impact page"
					>
						Previous
					</button>
					<span>Page {this.state.currentPage}</span>
					<button
						type="button"
						className="manage-film-impact-page__button manage-film-impact-page__button--secondary"
						onClick={this.onNextPage}
						disabled={!this.state.next}
						aria-label="Next film impact page"
					>
						Next
					</button>
				</div>
			</MediaListWrapper>
		);
	}
}

ManageFilmImpactPage.propTypes = {
	title: PropTypes.string.isRequired,
};

ManageFilmImpactPage.defaultProps = {
	title: 'Manage film impact',
};
