<?php
/**
 * Abstract check helper.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

abstract class WPSA_Abstract_Check implements WPSA_Check_Interface {

	/**
	 * Build normalized finding record.
	 *
	 * @param string               $control_id Control ID.
	 * @param string               $title Human title.
	 * @param string               $category Category name.
	 * @param string               $severity Severity.
	 * @param string               $status Status.
	 * @param array<string,mixed>  $evidence Evidence details.
	 * @param string               $remediation Guidance.
	 * @return array<string,mixed>
	 */
	protected function build_result( $control_id, $title, $category, $severity, $status, $evidence, $remediation ) {
		return array(
			'control_id'  => sanitize_text_field( $control_id ),
			'title'       => sanitize_text_field( $title ),
			'category'    => sanitize_text_field( $category ),
			'severity'    => sanitize_key( $severity ),
			'status'      => sanitize_key( $status ),
			'evidence'    => $evidence,
			'remediation' => sanitize_text_field( $remediation ),
			'timestamp'   => current_time( 'mysql', true ),
		);
	}
}
