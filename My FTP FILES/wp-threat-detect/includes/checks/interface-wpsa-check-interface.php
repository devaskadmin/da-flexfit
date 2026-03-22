<?php
/**
 * Check interface.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

interface WPSA_Check_Interface {

	/**
	 * Returns control ID.
	 *
	 * @return string
	 */
	public function get_control_id();

	/**
	 * Runs check and returns a normalized finding.
	 *
	 * @return array<string,mixed>
	 */
	public function run();
}
