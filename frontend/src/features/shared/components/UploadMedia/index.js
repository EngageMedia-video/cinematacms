// "Upload media" component group — controlled field assemblies, metadata
// validation and taxonomy data for upload flows. Single upload uses these as
// form-aware field building blocks; bulk uses the same controlled components
// for per-file metadata. Generic HTTP helpers live in shared/utils/api.
export * from './fields/BasicFields';
export * from './fields/OtherFields';
export * from './fields/FinalFields';
export * from './fields/AdminFields';
export * from './fields/ThumbnailUpload';
export { FieldLabel } from './FieldLabel';
export { EditorialPolicyNotice } from './EditorialPolicyNotice';
export { useTaxonomies } from './hooks/useTaxonomies';
export * from './schema/mediaMetadataSchema';
