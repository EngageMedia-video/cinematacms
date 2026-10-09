# Modern profile

The profile revamp is a multi-page modern-track feature. Django resolves every
profile route to the same `user_revamp.html` template and exposes the active tab
plus an author bootstrap payload. TanStack Query fetches only the data required
by the mounted section.

Profile routes always use the revamp template. The retired `UI_VARIANT_*`
settings cannot select the old profile UI. Channel, History, and Liked routes
still share code from `static/js/pages/ProfilePage/`.
