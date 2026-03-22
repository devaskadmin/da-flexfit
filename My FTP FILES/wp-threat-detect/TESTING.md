# WP Security SaaS Alpha - Testing Notes

## Environment Matrix

Test on at least:

- WordPress: 6.2, 6.4, latest
- PHP: 8.1, 8.2, 8.3
- Single-site install (alpha baseline)

## Docker Quick Start

1. Start WordPress + MySQL containers.
2. Mount plugin folder to `/var/www/html/wp-content/plugins/wp-threat-detect`.
3. Activate plugin in wp-admin.
4. Confirm redirect to Setup Wizard on first run.

## Functional Test Checklist

### Activation / Setup

- [ ] Activation succeeds without fatal errors.
- [ ] Setup wizard loads and saves profile values.
- [ ] "Run Initial Scan" from wizard creates a scan record.

### Dashboard

- [ ] "Run New Scan" executes and shows success notice.
- [ ] Overall score, status counts, and category scores render.
- [ ] Top actions list renders remediation text.

### Results

- [ ] Findings grouped by category.
- [ ] Status badges render (`pass`, `warning`, `fail`, `unknown`, `skipped`).
- [ ] Evidence JSON is visible and escaped.
- [ ] Status/category filters work.

### History

- [ ] Scan history table shows latest records.
- [ ] Trigger source reflects `manual`, `wizard`, or `cron`.

### Settings / Scheduler

- [ ] Changing `scan_mode` to daily schedules cron.
- [ ] Changing `scan_mode` to weekly schedules weekly cron.
- [ ] Changing `scan_mode` to manual removes cron schedule.

### Security / Hardening

- [ ] Nonce errors block forged form posts.
- [ ] Non-admin users cannot access plugin pages.
- [ ] No unescaped output in tables/views for findings and evidence.

### Uninstall

- [ ] Uninstall removes options.
- [ ] Uninstall drops scan history table.

## Known Alpha Limitations

- Header checks are lightweight and may return `unknown` in proxied environments.
- Backup verification is confidence-based, not full backup integrity validation.
- No firewall/malware scanning/SaaS sync in alpha scope.
