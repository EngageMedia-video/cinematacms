// "Upload media" component group — field primitives, form-field assemblies,
// metadata validation and taxonomy data, shared by the single (#523) and bulk
// (#524) upload flows. Grouped here under shared/components (it replaces the
// former separate upload-shared/ feature folder) so it lives with the rest of
// the design system and stays reusable across features. Generic HTTP helpers
// live in shared/utils/api.
export * from './fields/BasicFields';
export * from './fields/OtherFields';
export * from './fields/FinalFields';
export { CheckboxGroup } from './CheckboxGroup';
export { FieldLabel } from './FieldLabel';
export { EditorialPolicyNotice } from './EditorialPolicyNotice';
export { useTaxonomies } from './hooks/useTaxonomies';
export * from './schema/mediaMetadataSchema';
