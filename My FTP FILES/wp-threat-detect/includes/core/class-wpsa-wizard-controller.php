<?php
/**
 * Wizard controller.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Wizard_Controller {

	/**
	 * @var WPSA_Settings_Manager
	 */
	private $settings;

	/**
	 * @var WPSA_Scheduler
	 */
	private $scheduler;

	/**
	 * @var WPSA_Scan_Manager
	 */
	private $scanner;

	/**
	 * Constructor.
	 *
	 * @param WPSA_Settings_Manager $settings Settings manager.
	 * @param WPSA_Scheduler        $scheduler Scheduler.
	 * @param WPSA_Scan_Manager     $scanner Scanner.
	 */
	public function __construct( $settings, $scheduler, $scanner ) {
		$this->settings  = $settings;
		$this->scheduler = $scheduler;
		$this->scanner   = $scanner;
	}

	/**
	 * Registers wizard hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'admin_init', array( $this, 'maybe_redirect_to_wizard' ) );
	}

	/**
	 * Redirect on first run.
	 *
	 * @return void
	 */
	public function maybe_redirect_to_wizard() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( wp_doing_ajax() ) {
			return;
		}

		if ( $this->settings->is_wizard_complete() ) {
			return;
		}

		if ( isset( $_GET['page'] ) && 'wpsa-setup' === sanitize_key( wp_unslash( $_GET['page'] ) ) ) {
			return;
		}

		wp_safe_redirect( admin_url( 'admin.php?page=wpsa-setup' ) );
		exit;
	}

	/**
	 * Handles wizard submission.
	 *
	 * @return array{saved:bool,ran_initial_scan:bool}
	 */
	public function maybe_handle_submit() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return array( 'saved' => false, 'ran_initial_scan' => false );
		}

		if ( empty( $_POST['wpsa_wizard_submit'] ) ) {
			return array( 'saved' => false, 'ran_initial_scan' => false );
		}

		check_admin_referer( 'wpsa_wizard_action', 'wpsa_wizard_nonce' );

		$input = array(
			'site_type'            => sanitize_text_field( wp_unslash( $_POST['site_type'] ?? '' ) ),
			'business_criticality' => sanitize_text_field( wp_unslash( $_POST['business_criticality'] ?? '' ) ),
			'admin_count_estimate' => absint( $_POST['admin_count_estimate'] ?? 0 ),
			'processes_payments'   => absint( $_POST['processes_payments'] ?? 0 ),
			'stores_customer_data' => absint( $_POST['stores_customer_data'] ?? 0 ),
			'uses_backups'         => absint( $_POST['uses_backups'] ?? 0 ),
			'uses_mfa'             => absint( $_POST['uses_mfa'] ?? 0 ),
			'scan_mode'            => sanitize_text_field( wp_unslash( $_POST['scan_mode'] ?? 'manual' ) ),
		);

		$this->settings->save_settings( $input );
		$this->settings->set_wizard_complete();
		$this->scheduler->sync_schedule();

		$ran_initial_scan = ! empty( $_POST['run_initial_scan'] );
		if ( $ran_initial_scan ) {
			$this->scanner->run_scan( 'wizard' );
		}

		return array(
			'saved'           => true,
			'ran_initial_scan' => $ran_initial_scan,
		);
	}
}
