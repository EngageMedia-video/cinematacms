# Deploy the migrated UI

Home, Media, Upload, Edit Media, and Profile always use the revamp UI.
Their legacy templates and page entries have been removed as part of
[issue #755](https://github.com/EngageMedia-video/cinematacms/issues/755).

## Remove retired configuration

Remove these settings from deployment environment files and any remaining
`local_settings.py`:

- `UI_VARIANT_ALLOWED`
- `UI_VARIANT_DEFAULT`
- `UI_VARIANT_REVAMP_PAGES`

The application ignores these settings. The deployment environment renderer
no longer copies them from legacy configuration. The `?ui=revamp` preview
parameter is no longer needed, and `?ui=legacy` cannot restore the old UI.

## Build and verify

1. Build the assets with `make frontend-build`. Deploy the templates and built
   assets from the same revision.
2. Check Home and Media as an anonymous visitor. Check media playback,
   restricted-media access, and comment timestamp links.
3. Sign in and check Upload, Edit Media, and the Profile tabs. Confirm that
   another user cannot open the owner's private tabs.
4. Check Channel, History, Liked, and the embedded player. These routes still
   use shared legacy code.

The migrated pages use `base_modern.html` and mount into `#app-root`.
Other pages can still use `base.html`; its shared components remain supported.
See [Frontend workflow](FRONTEND_WORKFLOW.md#page-shells) for shell selection.

## Roll back a release

To restore the old UI, roll back to a release that still contains its templates
and assets using the deployment's normal rollback procedure. Changing a
`UI_VARIANT_*` setting cannot roll back this release.
