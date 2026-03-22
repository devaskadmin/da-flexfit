<?php
/**
 * XML-RPC check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_XMLRPC_Enabled extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'B-AUTH-002';
	}

	public function run() {
		$enabled = apply_filters( 'xmlrpc_enabled', true );
		$status  = $enabled ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'XML-RPC exposure',
			'Authentication and Access',
			'medium',
			$status,
			array(
				'xmlrpc_enabled' => (bool) $enabled,
			),
			'Disable XML-RPC unless required by trusted integrations.'
		);
	}
}
