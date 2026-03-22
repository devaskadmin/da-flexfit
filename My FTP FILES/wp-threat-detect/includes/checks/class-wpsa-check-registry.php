<?php
/**
 * Check registry.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Registry {

	/**
	 * Returns check instances.
	 *
	 * @return array<int,WPSA_Check_Interface>
	 */
	public function get_checks() {
		return array(
			new WPSA_Check_Core_Up_To_Date(),
			new WPSA_Check_Plugins_Up_To_Date(),
			new WPSA_Check_Themes_Up_To_Date(),
			new WPSA_Check_Supported_PHP_Version(),
			new WPSA_Check_File_Editor_Disabled(),
			new WPSA_Check_Debug_Mode_Disabled(),
			new WPSA_Check_Unused_Plugins_Detected(),
			new WPSA_Check_Unused_Themes_Detected(),
			new WPSA_Check_Admin_User_Exists(),
			new WPSA_Check_XMLRPC_Enabled(),
			new WPSA_Check_Registration_Role_Safety(),
			new WPSA_Check_User_Registration_Enabled(),
			new WPSA_Check_Admin_Count_Threshold(),
			new WPSA_Check_MFA_Plugin_Detected(),
			new WPSA_Check_DB_Prefix_Default(),
			new WPSA_Check_Salts_Present(),
			new WPSA_Check_Auto_Repair_Enabled(),
			new WPSA_Check_Backup_Plugin_Installed(),
			new WPSA_Check_Backup_Configuration_Known(),
			new WPSA_Check_Site_URLs_Use_HTTPS(),
			new WPSA_Check_SSL_Detected(),
			new WPSA_Check_Header_HSTS_Present(),
			new WPSA_Check_Header_XFO_Present(),
			new WPSA_Check_Header_XCTO_Present(),
			new WPSA_Check_Header_Referrer_Policy_Present(),
			new WPSA_Check_Header_CSP_Present(),
			new WPSA_Check_Readme_Exposed(),
			new WPSA_Check_Version_Exposure_Present(),
			new WPSA_Check_Directory_Listing_Exposed(),
			new WPSA_Check_WP_Config_Protection(),
		);
	}
}
