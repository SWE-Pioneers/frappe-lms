# CLAUDE.md — frappe-lms (SWE-Pioneers fork)

Changes on top of upstream `frappe/lms` (main).

## Arabic i18n
- `lms/locale/ar.po` completed to **100% of app-owned strings** (Libyan-appropriate MSA), tagged
  `ai-translated; needs-native-review`. Built/filled via the parent repo's `scripts/i18n` pipeline
  (`generate-pot-file` sync for full doctype/field coverage). See the parent `SWE-Pioneers/frappe`
  `CLAUDE.md` for the pipeline + the runtime `.mo` compile mechanics.
- RTL was already present upstream (dir from `boot.text_direction`).

## Deploy
Built from `~/build/lms-custom` on the VPS (Containerfile repointed to this fork + per-app
`compile-po-to-mo`). Rebuild with `--no-cache`; see the parent `CLAUDE.md` for the `.mo` compile +
persist gotchas.
