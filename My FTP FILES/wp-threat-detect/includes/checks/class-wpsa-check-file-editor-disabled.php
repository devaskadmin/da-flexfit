<?php
/**
 * File editor disabled check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_File_Editor_Disabled extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'A-CORE-005';
	}

	public function run() {
		$disabled = defined( 'DISALLOW_FILE_EDIT' ) && DISALLOW_FILE_EDIT;
		$status   = $disabled ? 'pass' : 'warning';

		return $this->build_result(
			$this->get_control_id(),
			'File editor disabled',
			'Core WordPress Hygiene',
			'high',
			$status,
			array(
				'disallow_file_edit' => $disabled,
			),
			'Set DISALLOW_FILE_EDIT to true in wp-config.php to reduce dashboard code-edit risk.'
		);
	}
}
