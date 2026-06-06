export function buildSections(filters, sort, filterOptionSections) {
	return [
		{
			key: 'category',
			label: 'Category',
			selectMode: 'multi',
			selectedValues: filters.category,
			options: filterOptionSections.category,
		},
		{
			key: 'topic',
			label: 'Topic',
			selectMode: 'multi',
			selectedValues: filters.topic,
			options: filterOptionSections.topic,
		},
		{
			key: 'subtitle_language',
			label: 'Subtitle Language',
			selectMode: 'multi',
			selectedValues: filters.subtitle_language,
			options: filterOptionSections.subtitle_language,
		},
		{
			key: 'country',
			label: 'Country of Origin',
			selectMode: 'multi',
			selectedValues: filters.country,
			options: filterOptionSections.country,
		},
		{
			key: 'length',
			label: 'Length',
			selectMode: 'single',
			selectedValues: filters.length,
			options: filterOptionSections.length,
		},
		{
			key: 'upload_date',
			label: 'Upload Date',
			selectMode: 'single',
			selectedValues: filters.upload_date,
			options: filterOptionSections.upload_date,
		},
		{
			key: 'sort',
			label: 'Popularity',
			selectMode: 'single',
			selectedValues: sort.popularity,
			options: filterOptionSections.sort,
		},
		{
			key: 'license',
			label: 'License',
			selectMode: 'multi',
			selectedValues: filters.license,
			options: filterOptionSections.license,
		},
		{
			key: 'community_impact',
			label: 'Community Impact',
			selectMode: 'multi',
			selectedValues: filters.community_impact,
			options: filterOptionSections.community_impact,
		},
	];
}
