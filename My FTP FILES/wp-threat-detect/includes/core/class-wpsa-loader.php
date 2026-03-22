<?php
/**
 * File loader for plugin classes.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Loader {

	/**
	 * Loads all required files.
	 *
	 * @return void
	 */
	public static function load() {
		$files = array(
			'includes/core/class-wpsa-settings-manager.php',
			'includes/storage/class-wpsa-scan-repository.php',
			'includes/scoring/class-wpsa-score-calculator.php',
			'includes/checks/interface-wpsa-check-interface.php',
			'includes/checks/abstract-wpsa-check.php',
			'includes/checks/class-wpsa-check-registry.php',
			'includes/checks/class-wpsa-check-core-up-to-date.php',
			'includes/checks/class-wpsa-check-plugins-up-to-date.php',
			'includes/checks/class-wpsa-check-themes-up-to-date.php',
			'includes/checks/class-wpsa-check-supported-php-version.php',
			'includes/checks/class-wpsa-check-file-editor-disabled.php',
			'includes/checks/class-wpsa-check-debug-mode-disabled.php',
			'includes/checks/class-wpsa-check-unused-plugins-detected.php',
			'includes/checks/class-wpsa-check-unused-themes-detected.php',
			'includes/checks/class-wpsa-check-admin-user-exists.php',
			'includes/checks/class-wpsa-check-xmlrpc-enabled.php',
			'includes/checks/class-wpsa-check-registration-role-safety.php',
			'includes/checks/class-wpsa-check-user-registration-enabled.php',
			'includes/checks/class-wpsa-check-admin-count-threshold.php',
			'includes/checks/class-wpsa-check-mfa-plugin-detected.php',
			'includes/checks/class-wpsa-check-db-prefix-default.php',
			'includes/checks/class-wpsa-check-salts-present.php',
			'includes/checks/class-wpsa-check-auto-repair-enabled.php',
			'includes/checks/class-wpsa-check-backup-plugin-installed.php',
			'includes/checks/class-wpsa-check-backup-configuration-known.php',
			'includes/checks/class-wpsa-check-site-urls-use-https.php',
			'includes/checks/class-wpsa-check-ssl-detected.php',
			'includes/checks/class-wpsa-check-header-hsts-present.php',
			'includes/checks/class-wpsa-check-header-xfo-present.php',
			'includes/checks/class-wpsa-check-header-xcto-present.php',
			'includes/checks/class-wpsa-check-header-referrer-policy-present.php',
			'includes/checks/class-wpsa-check-header-csp-present.php',
			'includes/checks/class-wpsa-check-readme-exposed.php',
			'includes/checks/class-wpsa-check-version-exposure-present.php',
			'includes/checks/class-wpsa-check-directory-listing-exposed.php',
			'includes/checks/class-wpsa-check-wp-config-protection.php',
			'includes/core/class-wpsa-scan-manager.php',
			'includes/core/class-wpsa-scheduler.php',
			'includes/core/class-wpsa-wizard-controller.php',
			'admin/class-wpsa-admin-controller.php',
		);

		foreach ( $files as $file ) {
			require_once WPSA_PLUGIN_DIR . $file;
		}
	}
}
