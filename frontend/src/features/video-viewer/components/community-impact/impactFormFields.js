export const IMPACT_DETAILS_MAX_WORDS = 80;
export const MIN_IMPACT_YEAR = 1900;

// Order and copy follow the Figma "Impact Form" category options; emblems come from impactIcons.
export const IMPACT_FORM_CATEGORIES = [
	{
		value: 'award',
		label: 'Recognition',
		description: 'Won an award, nomination, or special mention.',
	},
	{
		value: 'screening',
		label: 'Screening',
		description: 'Shown to an audience at a festival, community screening, or online.',
	},
	{
		value: 'teaching',
		label: 'Teaching or Research',
		description: 'Used in a class, course, workshop, or research.',
	},
	{
		value: 'referenced',
		label: 'Referenced in Another Work',
		description: 'Mentioned or used in a film, artwork, song, or performance.',
	},
	{
		value: 'article',
		label: 'Article or Review',
		description: 'Written about in an article, review, book, or newsletter.',
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

const linkField = (placeholder) => ({ name: 'url', type: 'url', label: 'Link (optional)', placeholder });

// Field order and copy follow the Figma "Impact Form" variants. Where a variant
// repeats another category's hint (details and link), the hint is written for
// the category instead. Award keeps a Result select, which the design leaves
// out but the server requires.
export const IMPACT_FORM_FIELDS = {
	award: [
		{
			name: 'title',
			type: 'text',
			label: 'Recognition',
			placeholder: 'Example: Winner for Best Documentary, Nominated for Best Editing',
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
			placeholder: 'Festival, organisation, or institution that gave the award',
			required: true,
		},
		{ name: 'year', type: 'year', label: 'Year', placeholder: 'When was this given?', required: true },
		{
			name: 'details',
			type: 'textarea',
			label: 'Citation (optional)',
			placeholder: 'The jury’s statement, if there is one',
		},
		linkField('Announcement or festival page (https://...)'),
	],
	screening: [
		{
			name: 'title',
			type: 'text',
			label: 'Event or Festival Name',
			placeholder: 'The name of the festival, screening, or programme',
			required: true,
		},
		{ name: 'year', type: 'year', label: 'Year', placeholder: 'When was it screened?', required: true },
		{ name: 'is_online', type: 'checkbox', label: 'This was an online screening' },
		{
			name: 'city',
			type: 'text',
			label: 'City',
			placeholder: 'Where did it happen?',
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
			placeholder: 'The group, collective, or curator behind the screening',
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
			placeholder: 'Audience size, the discussion after, how people responded',
		},
		linkField('Announcement or festival page (https://...)'),
	],
	teaching: [
		{ name: 'title', type: 'text', label: 'Course or Class Name', required: true },
		{ name: 'organiser', type: 'text', label: 'School or University', required: true },
		{ name: 'country', type: 'select', label: 'Country', options: IMPACT_COUNTRY_OPTIONS, required: true },
		{
			name: 'year',
			type: 'year',
			label: 'Year',
			placeholder: 'When was it used?',
			helperText: 'For a course that runs across two years, use the year it started.',
			required: true,
		},
		{
			name: 'term',
			type: 'text',
			label: 'Term (optional)',
			placeholder: 'E.g. 1st semester, summer term',
			maxLength: 100,
		},
		{ name: 'creator', type: 'text', label: 'Teacher or Facilitator (optional)' },
		{
			name: 'details',
			type: 'textarea',
			label: 'Anything else to share? (optional)',
			placeholder: 'How the film was used, and how people responded',
		},
		linkField('A course or research page (https://...)'),
	],
	referenced: [
		{ name: 'title', type: 'text', label: 'Title of Work', required: true },
		{
			name: 'year',
			type: 'year',
			label: 'Year',
			placeholder: 'When was this work released?',
			required: true,
		},
		{
			name: 'creator',
			type: 'text',
			label: 'Made by',
			placeholder: 'Artist, filmmaker, writer, or group',
			required: true,
		},
		{ name: 'medium', type: 'select', label: 'Medium', options: IMPACT_MEDIUM_OPTIONS, required: true },
		{
			name: 'details',
			type: 'textarea',
			label: 'Anything else to share? (optional)',
			placeholder: 'How the film appears in the work',
		},
		linkField('A page about the work (https://...)'),
	],
	article: [
		{
			name: 'title',
			type: 'text',
			label: 'Title',
			placeholder: 'Title of the article, review, or book',
			required: true,
		},
		{ name: 'year', type: 'year', label: 'Year', placeholder: 'When was this published?', required: true },
		{
			name: 'creator',
			type: 'text',
			label: 'Created by',
			placeholder: 'Author or writer’s name',
			required: true,
		},
		{
			name: 'publication',
			type: 'text',
			label: 'Where was it published? (optional)',
			placeholder: 'Name of publication, website, journal, or publisher',
		},
		{
			name: 'details',
			type: 'textarea',
			label: 'Anything else to share? (optional)',
			placeholder: 'What the piece said about the film',
		},
		linkField('Where the piece can be read (https://...)'),
	],
};

export function getVisibleImpactFields(category, values) {
	return (IMPACT_FORM_FIELDS[category] ?? []).filter((field) => !field.hidden?.(values));
}
