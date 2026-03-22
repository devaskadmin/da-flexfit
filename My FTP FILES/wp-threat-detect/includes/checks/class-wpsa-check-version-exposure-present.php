<?php
/**
 * WP version exposure check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Version_Exposure_Present extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'F-FILE-002';
	}

	public function run() {
		$generator = wp_generator();
		$exposed   = ! empty( $generator ) && false !== stripos( $generator, 'wordpress' );
		$status    = $exposed ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'WordPress version exposure',
			'File / Environment Hardening',
			'low',
			$status,
			array(
				'generator_tag_present' => $exposed,
			),
			'Reduce public version disclosure where practical while prioritizing timely patching.'
		);
	}
}
