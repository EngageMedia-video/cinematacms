// Carries the upload's id on every request of that upload, so nginx and the app can log it: the
// server's upload id once the upload exists, and an id minted in the browser on the creation request.
export const UPLOAD_ID_HEADER = 'X-Upload-Id';
