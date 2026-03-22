=== WP Security SaaS Alpha ===
Contributors: devasterisks
Tags: security, scanner, hardening, assessment
Requires at least: 6.2
Tested up to: 6.7
Requires PHP: 8.1
Stable tag: 0.1.0-alpha
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Assessment-first WordPress security posture scanner and scoring plugin (alpha).

== Description ==

WP Security SaaS Alpha is designed to assess security posture only.
It does not act as a firewall and does not perform malware signature scanning.

Features in alpha:

- Setup wizard for profile context
- Manual and scheduled scans (WP-Cron)
- Modular checks with categories and severity
- Weighted security scoring
- Local scan history storage
- Admin dashboard and results pages with remediation guidance

== Installation ==

1. Upload plugin folder to `/wp-content/plugins/wp-security-saas-alpha`
2. Activate from WordPress Plugins page
3. Open WP Security Alpha in admin menu
4. Complete wizard and run initial scan

== Frequently Asked Questions ==

= Does this plugin block attacks? =
No. Alpha scope is assessment and reporting only.

= Does this plugin auto-fix site settings? =
No. Findings include remediation guidance only.

= Where is scan history stored? =
In a local WordPress custom table (`{prefix}wpsa_scans`).

== Changelog ==

= 0.1.0-alpha =
* Initial alpha architecture and scanner implementation.

== Upgrade Notice ==

= 0.1.0-alpha =
Alpha release for local testing and iterative development.
