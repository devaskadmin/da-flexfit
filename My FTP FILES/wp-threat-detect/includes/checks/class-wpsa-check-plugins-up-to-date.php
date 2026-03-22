<?php
/**
 * Plugin updates check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Plugins_Up_To_Date extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'A-CORE-002';
	}

	public function run() {
		$updates       = get_site_transient( 'update_plugins' );
		$pending_count = 0;

		if ( isset( $updates->response ) && is_array( $updates->response ) ) {
			$pending_count = count( $updates->response );
		}

		$status = $pending_count > 0 ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Plugins up to date',
			'Core WordPress Hygiene',
			'high',
			$status,
			array(
				'pending_plugin_updates' => $pending_count,
			),
			'Review and apply plugin updates regularly. Remove abandoned plugins where possible.'
		);
	}
}
