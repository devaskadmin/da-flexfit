<?php
/**
 * Theme updates check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Themes_Up_To_Date extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'A-CORE-003';
	}

	public function run() {
		$updates       = get_site_transient( 'update_themes' );
		$pending_count = 0;

		if ( isset( $updates->response ) && is_array( $updates->response ) ) {
			$pending_count = count( $updates->response );
		}

		$status = $pending_count > 0 ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Themes up to date',
			'Core WordPress Hygiene',
			'medium',
			$status,
			array(
				'pending_theme_updates' => $pending_count,
			),
			'Update active themes and remove unnecessary themes to reduce attack surface.'
		);
	}
}
