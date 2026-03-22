<?php
/**
 * Main plugin runtime.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Plugin {

	/**
	 * @var WPSA_Scan_Repository
	 */
	private $repository;

	/**
	 * @var WPSA_Settings_Manager
	 */
	private $settings;

	/**
	 * @var WPSA_Scheduler
	 */
	private $scheduler;

	/**
	 * @var WPSA_Admin_Controller
	 */
	private $admin;

	/**
	 * Constructor.
	 */
	public function __construct() {
		WPSA_Loader::load();

		$this->settings   = new WPSA_Settings_Manager();
		$this->repository = new WPSA_Scan_Repository();
		$registry         = new WPSA_Check_Registry();
		$scorer           = new WPSA_Score_Calculator();
		$scanner          = new WPSA_Scan_Manager( $registry, $scorer, $this->repository, $this->settings );
		$this->scheduler  = new WPSA_Scheduler( $this->settings, $scanner );
		$wizard           = new WPSA_Wizard_Controller( $this->settings, $this->scheduler, $scanner );
		$this->admin      = new WPSA_Admin_Controller( $this->settings, $scanner, $this->repository, $wizard, $this->scheduler );

		$wizard->register_hooks();
	}

	/**
	 * Runs plugin hooks.
	 *
	 * @return void
	 */
	public function run() {
		$this->scheduler->register_hooks();
		$this->admin->register_hooks();
	}

	/**
	 * Activation hook.
	 *
	 * @return void
	 */
	public static function activate() {
		WPSA_Loader::load();
		$repository = new WPSA_Scan_Repository();
		$repository->maybe_create_table();
		add_option( WPSA_OPTION_SETTINGS, array(), '', false );
		update_option( WPSA_OPTION_WIZARD_DONE, 0, false );
	}

	/**
	 * Deactivation hook.
	 *
	 * @return void
	 */
	public static function deactivate() {
		WPSA_Loader::load();
		$settings  = new WPSA_Settings_Manager();
		$registry  = new WPSA_Check_Registry();
		$scorer    = new WPSA_Score_Calculator();
		$repo      = new WPSA_Scan_Repository();
		$scanner   = new WPSA_Scan_Manager( $registry, $scorer, $repo, $settings );
		$scheduler = new WPSA_Scheduler( $settings, $scanner );
		$scheduler->clear_schedule();
	}
}
