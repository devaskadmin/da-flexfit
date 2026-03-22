<?php
/**
 * Scan scheduler.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Scheduler {

	/**
	 * @var WPSA_Settings_Manager
	 */
	private $settings;

	/**
	 * @var WPSA_Scan_Manager
	 */
	private $scanner;

	/**
	 * Constructor.
	 *
	 * @param WPSA_Settings_Manager $settings Settings manager.
	 * @param WPSA_Scan_Manager     $scanner Scan manager.
	 */
	public function __construct( $settings, $scanner ) {
		$this->settings = $settings;
		$this->scanner  = $scanner;
	}

	/**
	 * Registers cron hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_filter( 'cron_schedules', array( $this, 'register_custom_schedules' ) );
		add_action( WPSA_CRON_HOOK, array( $this, 'run_scheduled_scan' ) );
	}

	/**
	 * Adds weekly schedule.
	 *
	 * @param array<string,mixed> $schedules Existing schedules.
	 * @return array<string,mixed>
	 */
	public function register_custom_schedules( $schedules ) {
		if ( ! isset( $schedules['weekly'] ) ) {
			$schedules['weekly'] = array(
				'interval' => WEEK_IN_SECONDS,
				'display'  => __( 'Once Weekly', 'wp-security-saas-alpha' ),
			);
		}
		return $schedules;
	}

	/**
	 * Ensures cron event matches settings.
	 *
	 * @return void
	 */
	public function sync_schedule() {
		$settings  = $this->settings->get_settings();
		$scan_mode = $settings['scan_mode'] ?? 'manual';

		$timestamp = wp_next_scheduled( WPSA_CRON_HOOK );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, WPSA_CRON_HOOK );
		}

		if ( 'manual' === $scan_mode ) {
			return;
		}

		$recurrence = 'daily';
		if ( 'weekly' === $scan_mode ) {
			$recurrence = 'weekly';
		}

		wp_schedule_event( time() + 120, $recurrence, WPSA_CRON_HOOK );
	}

	/**
	 * Executes scheduled scan.
	 *
	 * @return void
	 */
	public function run_scheduled_scan() {
		$this->scanner->run_scan( 'cron' );
	}

	/**
	 * Unschedules events.
	 *
	 * @return void
	 */
	public function clear_schedule() {
		$timestamp = wp_next_scheduled( WPSA_CRON_HOOK );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, WPSA_CRON_HOOK );
		}
	}
}
