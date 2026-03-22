<?php
/**
 * Backup configuration confidence check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Backup_Configuration_Known extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'D-BACKUP-002';
	}

	public function run() {
		$settings = get_option( WPSA_OPTION_SETTINGS, array() );
		$uses     = ! empty( $settings['uses_backups'] );
		$status   = $uses ? 'pass' : 'warning';

		return $this->build_result(
			$this->get_control_id(),
			'Backup configuration confidence',
			'Backup and Recovery',
			'medium',
			$status,
			array(
				'site_profile_uses_backups' => $uses,
				'confidence'                => $uses ? 'declared' : 'not_declared',
			),
			'Confirm backup frequency, retention, and restore validation. Mark this in setup when validated.'
		);
	}
}
