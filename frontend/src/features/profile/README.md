# Modern profile

The profile revamp is a multi-page modern-track feature. Django resolves every
profile route to the same `user_revamp.html` template and exposes the active tab
plus an author bootstrap payload. TanStack Query fetches only the data required
by the mounted section.

The legacy profile remains the default unless `profile` is included in
`UI_VARIANT_REVAMP_PAGES`.
