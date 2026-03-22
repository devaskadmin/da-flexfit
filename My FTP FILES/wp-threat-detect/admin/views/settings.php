<?php
/**
 * Settings view.
 *
 * @var array<string,mixed> $settings
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap wpsa-wrap">
	<h1><?php esc_html_e( 'Settings', 'wp-security-saas-alpha' ); ?></h1>
	<form method="post" class="wpsa-form-grid">
		<?php wp_nonce_field( 'wpsa_settings_action', 'wpsa_settings_nonce' ); ?>

		<label>
			<?php esc_html_e( 'Scan Mode', 'wp-security-saas-alpha' ); ?>
			<select name="scan_mode">
				<option value="manual" <?php selected( $settings['scan_mode'], 'manual' ); ?>><?php esc_html_e( 'Manual only', 'wp-security-saas-alpha' ); ?></option>
				<option value="daily" <?php selected( $settings['scan_mode'], 'daily' ); ?>><?php esc_html_e( 'Daily', 'wp-security-saas-alpha' ); ?></option>
				<option value="weekly" <?php selected( $settings['scan_mode'], 'weekly' ); ?>><?php esc_html_e( 'Weekly', 'wp-security-saas-alpha' ); ?></option>
			</select>
		</label>

		<label>
			<?php esc_html_e( 'High Admin Count Threshold', 'wp-security-saas-alpha' ); ?>
			<input type="number" min="1" name="high_admin_threshold" value="<?php echo esc_attr( (string) $settings['high_admin_threshold'] ); ?>">
		</label>

		<label><input type="checkbox" name="uses_backups" value="1" <?php checked( 1, (int) $settings['uses_backups'] ); ?>> <?php esc_html_e( 'Backups are used', 'wp-security-saas-alpha' ); ?></label>
		<label><input type="checkbox" name="uses_mfa" value="1" <?php checked( 1, (int) $settings['uses_mfa'] ); ?>> <?php esc_html_e( 'MFA is used', 'wp-security-saas-alpha' ); ?></label>

		<p>
			<button type="submit" class="button button-primary" name="wpsa_save_settings" value="1"><?php esc_html_e( 'Save Settings', 'wp-security-saas-alpha' ); ?></button>
		</p>
	</form>
</div>
