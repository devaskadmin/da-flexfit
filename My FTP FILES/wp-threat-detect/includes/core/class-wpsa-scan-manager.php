<?php
/**
 * Scan manager.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Scan_Manager {

	/**
	 * @var WPSA_Check_Registry
	 */
	private $registry;

	/**
	 * @var WPSA_Score_Calculator
	 */
	private $scorer;

	/**
	 * @var WPSA_Scan_Repository
	 */
	private $repository;

	/**
	 * @var WPSA_Settings_Manager
	 */
	private $settings;

	/**
	 * Constructor.
	 *
	 * @param WPSA_Check_Registry   $registry Check registry.
	 * @param WPSA_Score_Calculator $scorer Score calculator.
	 * @param WPSA_Scan_Repository  $repository Repository.
	 * @param WPSA_Settings_Manager $settings Settings manager.
	 */
	public function __construct( $registry, $scorer, $repository, $settings ) {
		$this->registry   = $registry;
		$this->scorer     = $scorer;
		$this->repository = $repository;
		$this->settings   = $settings;
	}

	/**
	 * Runs full scan and stores record.
	 *
	 * @param string $trigger_source Source: manual|cron|wizard.
	 * @return array<string,mixed>
	 */
	public function run_scan( $trigger_source = 'manual' ) {
		$findings = array();
		$checks   = $this->registry->get_checks();

		foreach ( $checks as $check ) {
			try {
				$findings[] = $check->run();
			} catch ( Exception $e ) {
				$findings[] = array(
					'control_id'  => $check->get_control_id(),
					'title'       => 'Check execution error',
					'category'    => 'System',
					'severity'    => 'medium',
					'status'      => 'unknown',
					'evidence'    => array( 'error' => $e->getMessage() ),
					'remediation' => 'Review plugin logs and server configuration.',
					'timestamp'   => current_time( 'mysql', true ),
				);
			}
		}

		$score_data = $this->scorer->calculate( $findings );
		$record     = array(
			'scan_uuid'             => wp_generate_uuid4(),
			'trigger_source'        => $trigger_source,
			'overall_score'         => (int) $score_data['overall_score'],
			'status_counts'         => $score_data['status_counts'],
			'category_scores'       => $score_data['category_scores'],
			'top_actions'           => $score_data['top_actions'],
			'findings'              => $findings,
			'site_profile_snapshot' => $this->settings->get_settings(),
		);

		$scan_id = $this->repository->insert_scan( $record );
		update_option( WPSA_OPTION_LAST_SCAN_ID, $scan_id, false );

		$record['id'] = $scan_id;
		return $record;
	}
}
