// "Upload media" component group — controlled field assemblies, metadata
// validation and taxonomy data for the bulk (#524) upload flow. Kept visually
// identical to the single-upload (#523) form by reusing the same shared
// primitives (TextField, EditorField, Dropdown, CheckboxGroup, RadioButton,
// CheckboxButton, MediaDropzone). Single keeps its own form components; this
// group is bulk's controlled, per-file composition layer. Generic HTTP helpers
// live in shared/utils/api.
export * from './fields/BasicFields';
export * from './fields/OtherFields';
export * from './fields/FinalFields';
export * from './fields/AdminFields';
export * from './fields/ThumbnailUpload';
export { FieldLabel } from './FieldLabel';
export { EditorialPolicyNotice } from './EditorialPolicyNotice';
export { useTaxonomies } from './hooks/useTaxonomies';
export * from './schema/mediaMetadataSchema';
