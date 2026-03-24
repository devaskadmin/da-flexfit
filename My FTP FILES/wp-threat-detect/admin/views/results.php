<?php
/**
 * Results view.
 *
 * @var array<string,mixed>|null $latest
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap wpsa-wrap">
	<div class="wpsa-page-head">
		<div>
			<h1><?php esc_html_e( 'Scan Results', 'wp-security-saas-alpha' ); ?></h1>
			<p><?php esc_html_e( 'Filter and review findings by status and category.', 'wp-security-saas-alpha' ); ?></p>
		</div>
		<form method="post">
			<?php wp_nonce_field( 'wpsa_run_scan_action', 'wpsa_run_scan_nonce' ); ?>
			<button type="submit" name="wpsa_run_scan" class="button button-primary"><?php esc_html_e( 'Run New Scan', 'wp-security-saas-alpha' ); ?></button>
		</form>
	</div>

	<?php if ( empty( $latest ) ) : ?>
		<div class="notice notice-info"><p><?php esc_html_e( 'No scan data found.', 'wp-security-saas-alpha' ); ?></p></div>
	<?php else : ?>
		<?php
		$selected_status   = isset( $_GET['wpsa_status'] ) ? sanitize_key( wp_unslash( $_GET['wpsa_status'] ) ) : 'all';
		$selected_category = isset( $_GET['wpsa_category'] ) ? sanitize_text_field( wp_unslash( $_GET['wpsa_category'] ) ) : 'all';

		$all_categories = array();
		foreach ( (array) $latest['findings'] as $finding ) {
			$category = (string) ( $finding['category'] ?? 'General' );
			if ( ! in_array( $category, $all_categories, true ) ) {
				$all_categories[] = $category;
			}
		}

		sort( $all_categories );
		?>

		<form method="get" class="wpsa-filter-bar">
			<input type="hidden" name="page" value="wpsa-results">
			<label>
				<?php esc_html_e( 'Status', 'wp-security-saas-alpha' ); ?>
				<select name="wpsa_status">
					<?php foreach ( array( 'all', 'pass', 'warning', 'fail', 'unknown', 'skipped' ) as $status ) : ?>
						<option value="<?php echo esc_attr( $status ); ?>" <?php selected( $selected_status, $status ); ?>><?php echo esc_html( ucfirst( $status ) ); ?></option>
					<?php endforeach; ?>
				</select>
			</label>
			<label>
				<?php esc_html_e( 'Category', 'wp-security-saas-alpha' ); ?>
				<select name="wpsa_category">
					<option value="all" <?php selected( $selected_category, 'all' ); ?>><?php esc_html_e( 'All Categories', 'wp-security-saas-alpha' ); ?></option>
					<?php foreach ( $all_categories as $category_option ) : ?>
						<option value="<?php echo esc_attr( $category_option ); ?>" <?php selected( $selected_category, $category_option ); ?>><?php echo esc_html( $category_option ); ?></option>
					<?php endforeach; ?>
				</select>
			</label>
			<button type="submit" class="button"><?php esc_html_e( 'Apply Filters', 'wp-security-saas-alpha' ); ?></button>
		</form>

		<?php
		$grouped = array();
		foreach ( (array) $latest['findings'] as $finding ) {
			$status = sanitize_key( (string) ( $finding['status'] ?? 'unknown' ) );
			if ( 'all' !== $selected_status && $selected_status !== $status ) {
				continue;
			}

			$category = (string) ( $finding['category'] ?? 'General' );
			if ( 'all' !== $selected_category && $selected_category !== $category ) {
				continue;
			}

			$grouped[ $category ][] = $finding;
		}
		?>

		<?php if ( empty( $grouped ) ) : ?>
			<div class="notice notice-info"><p><?php esc_html_e( 'No findings match the current filters.', 'wp-security-saas-alpha' ); ?></p></div>
		<?php endif; ?>

		<?php foreach ( $grouped as $category => $findings ) : ?>
			<div class="wpsa-card">
				<h2><?php echo esc_html( $category ); ?></h2>
				<table class="widefat striped wpsa-table">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Control', 'wp-security-saas-alpha' ); ?></th>
							<th><?php esc_html_e( 'Status', 'wp-security-saas-alpha' ); ?></th>
							<th><?php esc_html_e( 'Severity', 'wp-security-saas-alpha' ); ?></th>
							<th><?php esc_html_e( 'Evidence', 'wp-security-saas-alpha' ); ?></th>
							<th><?php esc_html_e( 'Remediation', 'wp-security-saas-alpha' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $findings as $finding ) : ?>
							<tr>
								<td><strong><?php echo esc_html( (string) $finding['control_id'] ); ?></strong><br><?php echo esc_html( (string) $finding['title'] ); ?></td>
								<td><span class="wpsa-badge wpsa-status-<?php echo esc_attr( (string) $finding['status'] ); ?>"><?php echo esc_html( ucfirst( (string) $finding['status'] ) ); ?></span></td>
								<td><?php echo esc_html( ucfirst( (string) $finding['severity'] ) ); ?></td>
								<td><pre><?php echo esc_html( wp_json_encode( $finding['evidence'], JSON_PRETTY_PRINT ) ); ?></pre></td>
								<td><?php echo esc_html( (string) $finding['remediation'] ); ?></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>
		<?php endforeach; ?>
	<?php endif; ?>
</div>
