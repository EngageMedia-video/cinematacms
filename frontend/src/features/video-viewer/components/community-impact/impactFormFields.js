export const IMPACT_DETAILS_MAX_WORDS = 80;
export const MIN_IMPACT_YEAR = 1900;

export const IMPACT_FORM_CATEGORIES = [
	{
		value: 'screening',
		label: 'Screening',
		description: 'Shown to an audience at a festival, community screening, or online.',
	},
	{
		value: 'article',
		label: 'Article or Review',
		description: 'Written about in an article, review, book, or newsletter.',
	},
	{
		value: 'referenced',
		label: 'Referenced in Another Work',
		description: 'Mentioned or used in a film, artwork, song, or performance.',
	},
	{
		value: 'award',
		label: 'Award',
		description: 'Won an award, nomination, or special mention.',
	},
	{
		value: 'teaching',
		label: 'Teaching or Research',
		description: 'Used in a class, course, workshop, or research.',
	},
];

// Mirrors CommunityImpact.MEDIUM_CHOICES and AWARD_RESULT_CHOICES in files/models.py.
export const IMPACT_MEDIUM_OPTIONS = [
	{ value: 'film', label: 'Film' },
	{ value: 'artwork', label: 'Artwork' },
	{ value: 'music', label: 'Song or Music' },
	{ value: 'performance', label: 'Performance' },
	{ value: 'writing', label: 'Writing' },
	{ value: 'other', label: 'Other' },
];

export const IMPACT_AWARD_RESULT_OPTIONS = [
	{ value: 'won', label: 'Won' },
	{ value: 'nominated', label: 'Nominated' },
	{ value: 'special_mention', label: 'Special Mention' },
];

// Mirrors lists.video_countries in files/lists.py; the server rejects any other code.
export const IMPACT_COUNTRY_OPTIONS = [
	{ value: 'AU', label: 'Australia' },
	{ value: 'BD', label: 'Bangladesh' },
	{ value: 'BT', label: 'Bhutan' },
	{ value: 'BN', label: 'Brunei Darussalam' },
	{ value: 'BU', label: 'Bougainville' },
	{ value: 'KH', label: 'Cambodia' },
	{ value: 'CN', label: 'China' },
	{ value: 'FJ', label: 'Fiji' },
	{ value: 'PF', label: 'French Polynesia' },
	{ value: 'GU', label: 'Guam' },
	{ value: 'HA', label: 'Hawaii' },
	{ value: 'HK', label: 'Hong Kong' },
	{ value: 'IN', label: 'India' },
	{ value: 'ID', label: 'Indonesia' },
	{ value: 'JP', label: 'Japan' },
	{ value: 'KI', label: 'Kiribati' },
	{ value: 'KP', label: "Korea, Democratic People's Republic Of" },
	{ value: 'KR', label: 'South Korea' },
	{ value: 'LA', label: 'Laos' },
	{ value: 'MY', label: 'Malaysia' },
	{ value: 'MV', label: 'Maldives' },
	{ value: 'MH', label: 'Marshall Islands' },
	{ value: 'FM', label: 'Micronesia, Federated States Of' },
	{ value: 'MN', label: 'Mongolia' },
	{ value: 'MM', label: 'Myanmar' },
	{ value: 'NR', label: 'Nauru' },
	{ value: 'NP', label: 'Nepal' },
	{ value: 'NC', label: 'New Caledonia' },
	{ value: 'NZ', label: 'New Zealand' },
	{ value: 'MP', label: 'Northern Mariana Islands' },
	{ value: 'PK', label: 'Pakistan' },
	{ value: 'PW', label: 'Palau' },
	{ value: 'PG', label: 'Papua New Guinea' },
	{ value: 'PH', label: 'Philippines' },
	{ value: 'PN', label: 'Pitcairn' },
	{ value: 'WS', label: 'Samoa' },
	{ value: 'SG', label: 'Singapore' },
	{ value: 'SB', label: 'Solomon Islands' },
	{ value: 'LK', label: 'Sri Lanka' },
	{ value: 'TW', label: 'Taiwan' },
	{ value: 'TH', label: 'Thailand' },
	{ value: 'TI', label: 'Tibet' },
	{ value: 'TL', label: 'Timor-Leste' },
	{ value: 'TK', label: 'Tokelau' },
	{ value: 'TO', label: 'Tonga' },
	{ value: 'TV', label: 'Tuvalu' },
	{ value: 'VU', label: 'Vanuatu' },
	{ value: 'VN', label: 'Viet Nam' },
	{ value: 'WP', label: 'West Papua' },
	{ value: 'AQ', label: 'Antarctica' },
	{ value: 'EG', label: 'Egypt' },
	{ value: 'XX', label: 'International' },
];

const isOnlineScreening = (values) => values.is_online === true;

const LINK_FIELD = { name: 'url', type: 'url', label: 'Link (optional)' };

// Field order and copy follow the Figma "Impact Form" variants. The design's
// article frame repeats the screening fields and its teaching frame holds the
// article fields, so teaching copy is written to match the same layout.
export const IMPACT_FORM_FIELDS = {
	screening: [
		{
			name: 'title',
			type: 'text',
			label: 'Event or Festival Name',
			helperText: 'The name of the festival, screening, or programme',
			required: true,
		},
		{ name: 'year', type: 'year', label: 'Year', helperText: 'When was it screened?', required: true },
		{ name: 'is_online', type: 'checkbox', label: 'This was an online screening' },
		{
			name: 'city',
			type: 'text',
			label: 'City',
			helperText: 'Where did it happen?',
			required: true,
			maxLength: 100,
			hidden: isOnlineScreening,
		},
		{
			name: 'country',
			type: 'select',
			label: 'Country',
			options: IMPACT_COUNTRY_OPTIONS,
			required: true,
			hidden: isOnlineScreening,
		},
		{
			name: 'organiser',
			type: 'text',
			label: 'Who organised it?',
			helperText: 'The group, collective, or curator behind the screening',
			required: true,
		},
		{
			name: 'organiser_private',
			type: 'checkbox',
			label: 'Keep organiser private',
			description: 'Only the film owner and site managers will see who organised it.',
		},
		{
			name: 'details',
			type: 'textarea',
			label: 'Anything else to share? (optional)',
			helperText: 'Audience size, the discussion after, how people responded',
		},
		{ ...LINK_FIELD, helperText: 'A page about the event, if there is one' },
	],
	article: [
		{
			name: 'title',
			type: 'text',
			label: 'Title',
			helperText: 'Title of the article, review, or book',
			required: true,
		},
		{ name: 'year', type: 'year', label: 'Year', helperText: 'When was this published?', required: true },
		{
			name: 'creator',
			type: 'text',
			label: 'Written by',
			helperText: 'Author or writer’s name',
			required: true,
		},
		{
			name: 'publication',
			type: 'text',
			label: 'Where was it published? (optional)',
			helperText: 'Publication, website, journal, or publisher',
		},
		{
			name: 'details',
			type: 'textarea',
			label: 'Anything else to share? (optional)',
			helperText: 'What the piece said about the film',
		},
		{ ...LINK_FIELD, helperText: 'Where the piece can be read, if it is online' },
	],
	referenced: [
		{ name: 'title', type: 'text', label: 'Title of Work', required: true },
		{ name: 'year', type: 'year', label: 'Year', helperText: 'When was this work released?', required: true },
		{
			name: 'creator',
			type: 'text',
			label: 'Made by',
			helperText: 'Artist, filmmaker, writer, or group',
			required: true,
		},
		{ name: 'medium', type: 'select', label: 'Medium', options: IMPACT_MEDIUM_OPTIONS, required: true },
		{
			name: 'details',
			type: 'textarea',
			label: 'Anything else to share? (optional)',
			helperText: 'How the film appears in the work',
		},
		{ ...LINK_FIELD, helperText: 'A page about the work, if there is one' },
	],
	award: [
		{
			name: 'title',
			type: 'text',
			label: 'Award Name',
			helperText: 'Example: Best Documentary, Jury Special Mention.',
			required: true,
		},
		{
			name: 'award_result',
			type: 'select',
			label: 'Result',
			options: IMPACT_AWARD_RESULT_OPTIONS,
			required: true,
		},
		{
			name: 'organiser',
			type: 'text',
			label: 'Given by',
			helperText: 'Festival, organisation, or institution that gave the award',
			required: true,
		},
		{ name: 'year', type: 'year', label: 'Year', helperText: 'When was this given?', required: true },
		{
			name: 'details',
			type: 'textarea',
			label: 'Citation (optional)',
			helperText: 'The jury’s statement, if there is one',
		},
		{ ...LINK_FIELD, helperText: 'Announcement or festival page' },
	],
	teaching: [
		{
			name: 'title',
			type: 'text',
			label: 'Course or Research Title',
			helperText: 'The class, course, workshop, or study that used the film',
			required: true,
		},
		{ name: 'year', type: 'year', label: 'Year', helperText: 'When was it used?', required: true },
		{
			name: 'creator',
			type: 'text',
			label: 'Led by',
			helperText: 'Teacher, facilitator, or researcher',
			required: true,
		},
		{
			name: 'organiser',
			type: 'text',
			label: 'Institution (optional)',
			helperText: 'School, university, or organisation',
		},
		{
			name: 'details',
			type: 'textarea',
			label: 'Anything else to share? (optional)',
			helperText: 'How the film was used, and how people responded',
		},
		{ ...LINK_FIELD, helperText: 'A course or research page, if there is one' },
	],
};

export function getVisibleImpactFields(category, values) {
	return (IMPACT_FORM_FIELDS[category] ?? []).filter((field) => !field.hidden?.(values));
}
