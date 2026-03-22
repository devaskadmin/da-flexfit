<?php
/**
 * Unused themes check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Unused_Themes_Detected extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'A-CORE-008';
	}

	public function run() {
		$themes        = wp_get_themes();
		$active_theme  = wp_get_theme();
		$active_stylesheet = $active_theme->get_stylesheet();

		$inactive = array();
		foreach ( $themes as $slug => $theme ) {
			if ( $slug !== $active_stylesheet ) {
				$inactive[] = $slug;
			}
		}

		$inactive_count = count( $inactive );
		$status         = $inactive_count > 1 ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Unused themes detected',
			'Core WordPress Hygiene',
			'low',
			$status,
			array(
				'inactive_themes'      => $inactive,
				'inactive_theme_count' => $inactive_count,
			),
			'Keep only required themes (plus one default fallback if desired).'
		);
	}
}
