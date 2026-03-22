<?php
/**
 * Core version check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Core_Up_To_Date extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'A-CORE-001';
	}

	public function run() {
		$updates = get_site_transient( 'update_core' );
		$status  = 'pass';

		if ( isset( $updates->updates ) && is_array( $updates->updates ) ) {
			foreach ( $updates->updates as $item ) {
				if ( isset( $item->response ) && 'latest' !== $item->response ) {
					$status = 'warning';
					break;
				}
			}
		}

		return $this->build_result(
			$this->get_control_id(),
			'WordPress core up to date',
			'Core WordPress Hygiene',
			'high',
			$status,
			array(
				'wp_version' => get_bloginfo( 'version' ),
			),
			'Apply the latest stable WordPress core updates after backup and validation.'
		);
	}
}
