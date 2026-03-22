<?php
/**
 * Backup plugin detection check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Backup_Plugin_Installed extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'D-BACKUP-001';
	}

	public function run() {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$known = array(
			'updraftplus/updraftplus.php',
			'backwpup/backwpup.php',
			'duplicator/duplicator.php',
			'vaultpress/vaultpress.php',
			'backupbuddy/backupbuddy.php',
		);

		$all_plugins = get_plugins();
		$found       = false;

		foreach ( $known as $slug ) {
			if ( isset( $all_plugins[ $slug ] ) ) {
				$found = true;
				break;
			}
		}

		$status = $found ? 'pass' : 'warning';

		return $this->build_result(
			$this->get_control_id(),
			'Backup solution appears installed',
			'Backup and Recovery',
			'high',
			$status,
			array(
				'backup_plugin_detected' => $found,
			),
			'Install and configure a reliable backup mechanism with regular restore testing.'
		);
	}
}
