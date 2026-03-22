<?php
/**
 * Admin controller.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Admin_Controller {

	/**
	 * @var WPSA_Settings_Manager
	 */
	private $settings;

	/**
	 * @var WPSA_Scan_Manager
	 */
	private $scanner;

	/**
	 * @var WPSA_Scan_Repository
	 */
	private $repository;

	/**
	 * @var WPSA_Wizard_Controller
	 */
	private $wizard;

	/**
	 * @var WPSA_Scheduler
	 */
	private $scheduler;

	/**
	 * Constructor.
	 *
	 * @param WPSA_Settings_Manager  $settings Settings.
	 * @param WPSA_Scan_Manager      $scanner Scanner.
	 * @param WPSA_Scan_Repository   $repository Repo.
	 * @param WPSA_Wizard_Controller $wizard Wizard.
	 * @param WPSA_Scheduler         $scheduler Scheduler.
	 */
	public function __construct( $settings, $scanner, $repository, $wizard, $scheduler ) {
		$this->settings   = $settings;
		$this->scanner    = $scanner;
		$this->repository = $repository;
		$this->wizard     = $wizard;
		$this->scheduler  = $scheduler;
	}

	/**
	 * Registers admin hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Register admin menus.
	 *
	 * @return void
	 */
	public function register_menu() {
		$cap = 'manage_options';

		add_menu_page(
			__( 'WP Security Alpha', 'wp-security-saas-alpha' ),
			__( 'WP Security Alpha', 'wp-security-saas-alpha' ),
			$cap,
			'wpsa-dashboard',
			array( $this, 'render_dashboard_page' ),
			'dashicons-shield',
			58
		);

		add_submenu_page( 'wpsa-dashboard', __( 'Dashboard', 'wp-security-saas-alpha' ), __( 'Dashboard', 'wp-security-saas-alpha' ), $cap, 'wpsa-dashboard', array( $this, 'render_dashboard_page' ) );
		add_submenu_page( 'wpsa-dashboard', __( 'Scan Results', 'wp-security-saas-alpha' ), __( 'Scan Results', 'wp-security-saas-alpha' ), $cap, 'wpsa-results', array( $this, 'render_results_page' ) );
		add_submenu_page( 'wpsa-dashboard', __( 'Setup Wizard', 'wp-security-saas-alpha' ), __( 'Wizard / Setup', 'wp-security-saas-alpha' ), $cap, 'wpsa-setup', array( $this, 'render_setup_page' ) );
		add_submenu_page( 'wpsa-dashboard', __( 'Settings', 'wp-security-saas-alpha' ), __( 'Settings', 'wp-security-saas-alpha' ), $cap, 'wpsa-settings', array( $this, 'render_settings_page' ) );
		add_submenu_page( 'wpsa-dashboard', __( 'Scan History', 'wp-security-saas-alpha' ), __( 'Scan History', 'wp-security-saas-alpha' ), $cap, 'wpsa-history', array( $this, 'render_history_page' ) );
	}

	/**
	 * Enqueue CSS.
	 *
	 * @param string $hook Hook suffix.
	 * @return void
	 */
	public function enqueue_assets( $hook ) {
		if ( false === strpos( $hook, 'wpsa' ) ) {
			return;
		}
		wp_enqueue_style( 'wpsa-admin', WPSA_PLUGIN_URL . 'assets/css/admin.css', array(), WPSA_VERSION );
	}

	/**
	 * Render dashboard.
	 *
	 * @return void
	 */
	public function render_dashboard_page() {
		$this->assert_access();
		$latest = $this->repository->get_latest_scan();

		if ( ! empty( $_POST['wpsa_run_scan'] ) ) {
			check_admin_referer( 'wpsa_run_scan_action', 'wpsa_run_scan_nonce' );
			$latest = $this->scanner->run_scan( 'manual' );
			echo '<div class="notice notice-success"><p>' . esc_html__( 'Manual scan completed.', 'wp-security-saas-alpha' ) . '</p></div>';
		}

		require WPSA_PLUGIN_DIR . 'admin/views/dashboard.php';
	}

	/**
	 * Render results page.
	 *
	 * @return void
	 */
	public function render_results_page() {
		$this->assert_access();

		if ( ! empty( $_POST['wpsa_run_scan'] ) ) {
			check_admin_referer( 'wpsa_run_scan_action', 'wpsa_run_scan_nonce' );
			$this->scanner->run_scan( 'manual' );
			echo '<div class="notice notice-success"><p>' . esc_html__( 'Manual scan completed.', 'wp-security-saas-alpha' ) . '</p></div>';
		}

		$latest = $this->repository->get_latest_scan();
		require WPSA_PLUGIN_DIR . 'admin/views/results.php';
	}

	/**
	 * Render setup page.
	 *
	 * @return void
	 */
	public function render_setup_page() {
		$this->assert_access();
		$result   = $this->wizard->maybe_handle_submit();
		$settings = $this->settings->get_settings();
		require WPSA_PLUGIN_DIR . 'admin/views/setup.php';
	}

	/**
	 * Render settings page.
	 *
	 * @return void
	 */
	public function render_settings_page() {
		$this->assert_access();

		if ( ! empty( $_POST['wpsa_save_settings'] ) ) {
			check_admin_referer( 'wpsa_settings_action', 'wpsa_settings_nonce' );
			$input = array(
				'high_admin_threshold' => absint( $_POST['high_admin_threshold'] ?? 5 ),
				'scan_mode'            => sanitize_text_field( wp_unslash( $_POST['scan_mode'] ?? 'manual' ) ),
				'uses_mfa'             => absint( $_POST['uses_mfa'] ?? 0 ),
				'uses_backups'         => absint( $_POST['uses_backups'] ?? 0 ),
			);
			$base  = $this->settings->get_settings();
			$data  = array_merge( $base, $input );
			$this->settings->save_settings( $data );
			$this->scheduler->sync_schedule();
			echo '<div class="notice notice-success"><p>' . esc_html__( 'Settings saved.', 'wp-security-saas-alpha' ) . '</p></div>';
		}

		$settings = $this->settings->get_settings();
		require WPSA_PLUGIN_DIR . 'admin/views/settings.php';
	}

	/**
	 * Render history page.
	 *
	 * @return void
	 */
	public function render_history_page() {
		$this->assert_access();
		$history = $this->repository->get_scan_history( 50 );
		require WPSA_PLUGIN_DIR . 'admin/views/history.php';
	}

	/**
	 * Capability guard.
	 *
	 * @return void
	 */
	private function assert_access() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Access denied.', 'wp-security-saas-alpha' ) );
		}
	}
}
