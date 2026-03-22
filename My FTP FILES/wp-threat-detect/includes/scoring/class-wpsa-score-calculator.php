<?php
/**
 * Weighted score calculator.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Score_Calculator {

	/**
	 * Deduction map by severity and status.
	 *
	 * @var array<string,array<string,int>>
	 */
	private $deduction_map = array(
		'critical' => array(
			'fail'    => 20,
			'warning' => 12,
		),
		'high'     => array(
			'fail'    => 12,
			'warning' => 8,
		),
		'medium'   => array(
			'fail'    => 8,
			'warning' => 4,
		),
		'low'      => array(
			'fail'    => 4,
			'warning' => 2,
		),
	);

	/**
	 * Calculates score package.
	 *
	 * @param array<int,array<string,mixed>> $findings Check findings.
	 * @return array<string,mixed>
	 */
	public function calculate( $findings ) {
		$overall       = 100;
		$status_counts = array(
			'pass'    => 0,
			'warning' => 0,
			'fail'    => 0,
			'skipped' => 0,
			'unknown' => 0,
		);
		$categories    = array();
		$top_actions   = array();

		foreach ( $findings as $finding ) {
			$status   = sanitize_key( $finding['status'] ?? 'unknown' );
			$severity = sanitize_key( $finding['severity'] ?? 'medium' );
			$category = sanitize_text_field( $finding['category'] ?? 'General' );

			if ( isset( $status_counts[ $status ] ) ) {
				$status_counts[ $status ]++;
			}

			if ( ! isset( $categories[ $category ] ) ) {
				$categories[ $category ] = array(
					'score'      => 100,
					'deductions' => 0,
					'total'      => 0,
				);
			}

			$categories[ $category ]['total']++;

			$deduction = $this->get_deduction( $severity, $status );
			$overall  -= $deduction;
			$categories[ $category ]['deductions'] += $deduction;

			if ( in_array( $status, array( 'warning', 'fail' ), true ) ) {
				$top_actions[] = array(
					'control_id'  => sanitize_text_field( $finding['control_id'] ?? '' ),
					'title'       => sanitize_text_field( $finding['title'] ?? '' ),
					'severity'    => $severity,
					'status'      => $status,
					'remediation' => sanitize_text_field( $finding['remediation'] ?? '' ),
					'category'    => $category,
					'deduction'   => $deduction,
				);
			}
		}

		$overall = max( 0, min( 100, $overall ) );

		foreach ( $categories as $category => $meta ) {
			$categories[ $category ]['score'] = max( 0, min( 100, 100 - (int) $meta['deductions'] ) );
		}

		usort(
			$top_actions,
			function( $a, $b ) {
				return (int) $b['deduction'] <=> (int) $a['deduction'];
			}
		);

		return array(
			'overall_score'   => $overall,
			'status_counts'   => $status_counts,
			'category_scores' => $categories,
			'top_actions'     => array_slice( $top_actions, 0, 5 ),
		);
	}

	/**
	 * Get weighted deduction.
	 *
	 * @param string $severity Severity value.
	 * @param string $status Status value.
	 * @return int
	 */
	private function get_deduction( $severity, $status ) {
		if ( ! isset( $this->deduction_map[ $severity ][ $status ] ) ) {
			return 0;
		}
		return (int) $this->deduction_map[ $severity ][ $status ];
	}
}
