<?php
/**
 * Setup wizard view.
 *
 * @var array<string,mixed> $settings
 * @var array{saved:bool,ran_initial_scan:bool} $result
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap wpsa-wrap">
	<h1><?php esc_html_e( 'Setup Wizard', 'wp-security-saas-alpha' ); ?></h1>
	<p><?php esc_html_e( 'Configure baseline profile for security scoring context.', 'wp-security-saas-alpha' ); ?></p>

	<?php if ( ! empty( $result['saved'] ) ) : ?>
		<div class="notice notice-success"><p><?php esc_html_e( 'Wizard settings saved.', 'wp-security-saas-alpha' ); ?></p></div>
	<?php endif; ?>

	<form method="post" class="wpsa-form-grid">
		<?php wp_nonce_field( 'wpsa_wizard_action', 'wpsa_wizard_nonce' ); ?>

		<label>
			<?php esc_html_e( 'Site Type', 'wp-security-saas-alpha' ); ?>
			<select name="site_type">
				<?php foreach ( array( 'blog', 'brochure', 'ecommerce', 'membership', 'internal', 'other' ) as $type ) : ?>
					<option value="<?php echo esc_attr( $type ); ?>" <?php selected( $settings['site_type'], $type ); ?>><?php echo esc_html( ucfirst( $type ) ); ?></option>
				<?php endforeach; ?>
			</select>
		</label>

		<label>
			<?php esc_html_e( 'Business Criticality', 'wp-security-saas-alpha' ); ?>
			<select name="business_criticality">
				<?php foreach ( array( 'low', 'medium', 'high' ) as $level ) : ?>
					<option value="<?php echo esc_attr( $level ); ?>" <?php selected( $settings['business_criticality'], $level ); ?>><?php echo esc_html( ucfirst( $level ) ); ?></option>
				<?php endforeach; ?>
			</select>
		</label>

		<label>
			<?php esc_html_e( 'Approximate Number of Admins', 'wp-security-saas-alpha' ); ?>
			<input type="number" min="0" name="admin_count_estimate" value="<?php echo esc_attr( (string) $settings['admin_count_estimate'] ); ?>">
		</label>

		<label><input type="checkbox" name="processes_payments" value="1" <?php checked( 1, (int) $settings['processes_payments'] ); ?>> <?php esc_html_e( 'Site processes payments', 'wp-security-saas-alpha' ); ?></label>
		<label><input type="checkbox" name="stores_customer_data" value="1" <?php checked( 1, (int) $settings['stores_customer_data'] ); ?>> <?php esc_html_e( 'Site stores customer data', 'wp-security-saas-alpha' ); ?></label>
		<label><input type="checkbox" name="uses_backups" value="1" <?php checked( 1, (int) $settings['uses_backups'] ); ?>> <?php esc_html_e( 'Backups are used', 'wp-security-saas-alpha' ); ?></label>
		<label><input type="checkbox" name="uses_mfa" value="1" <?php checked( 1, (int) $settings['uses_mfa'] ); ?>> <?php esc_html_e( 'MFA is used', 'wp-security-saas-alpha' ); ?></label>

		<label>
			<?php esc_html_e( 'Preferred Scan Mode', 'wp-security-saas-alpha' ); ?>
			<select name="scan_mode">
				<option value="manual" <?php selected( $settings['scan_mode'], 'manual' ); ?>><?php esc_html_e( 'Manual only', 'wp-security-saas-alpha' ); ?></option>
				<option value="daily" <?php selected( $settings['scan_mode'], 'daily' ); ?>><?php esc_html_e( 'Daily', 'wp-security-saas-alpha' ); ?></option>
				<option value="weekly" <?php selected( $settings['scan_mode'], 'weekly' ); ?>><?php esc_html_e( 'Weekly', 'wp-security-saas-alpha' ); ?></option>
			</select>
		</label>

		<label><input type="checkbox" name="run_initial_scan" value="1"> <?php esc_html_e( 'Run Initial Scan after saving wizard', 'wp-security-saas-alpha' ); ?></label>

		<p>
			<button type="submit" class="button button-primary" name="wpsa_wizard_submit" value="1"><?php esc_html_e( 'Save Wizard Settings', 'wp-security-saas-alpha' ); ?></button>
		</p>
	</form>
</div>
