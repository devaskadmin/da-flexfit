<?php
/**
 * Dashboard view.
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
	<h1><?php esc_html_e( 'WP Security SaaS Alpha', 'wp-security-saas-alpha' ); ?></h1>
	<p><?php esc_html_e( 'Security posture scanner for WordPress (assessment only).', 'wp-security-saas-alpha' ); ?></p>

	<form method="post">
		<?php wp_nonce_field( 'wpsa_run_scan_action', 'wpsa_run_scan_nonce' ); ?>
		<button type="submit" name="wpsa_run_scan" class="button button-primary"><?php esc_html_e( 'Run New Scan', 'wp-security-saas-alpha' ); ?></button>
	</form>

	<?php if ( ! empty( $latest ) ) : ?>
		<?php $overall_score = (int) ( $latest['overall_score'] ?? 0 ); ?>
		<div class="wpsa-card-grid">
			<div class="wpsa-card">
				<h2><?php esc_html_e( 'Overall Score', 'wp-security-saas-alpha' ); ?></h2>
				<p class="wpsa-score"><?php echo esc_html( (string) $overall_score ); ?></p>
				<div class="wpsa-progress">
					<div class="wpsa-progress-bar" style="width: <?php echo esc_attr( (string) max( 0, min( 100, $overall_score ) ) ); ?>%;"></div>
				</div>
			</div>
			<div class="wpsa-card">
				<h2><?php esc_html_e( 'Status Counts', 'wp-security-saas-alpha' ); ?></h2>
				<ul>
					<?php foreach ( (array) $latest['status_counts'] as $status => $count ) : ?>
						<li><strong><?php echo esc_html( ucfirst( (string) $status ) ); ?>:</strong> <?php echo esc_html( (string) $count ); ?></li>
					<?php endforeach; ?>
				</ul>
			</div>
			<div class="wpsa-card">
				<h2><?php esc_html_e( 'Last Scan Date', 'wp-security-saas-alpha' ); ?></h2>
				<p><?php echo esc_html( (string) ( $latest['created_at'] ?? __( 'N/A', 'wp-security-saas-alpha' ) ) ); ?></p>
			</div>
		</div>

		<div class="wpsa-card">
			<h2><?php esc_html_e( 'Category Scores', 'wp-security-saas-alpha' ); ?></h2>
			<?php foreach ( (array) ( $latest['category_scores'] ?? array() ) as $category => $meta ) : ?>
				<?php $score = (int) ( $meta['score'] ?? 0 ); ?>
				<div class="wpsa-category-row">
					<div class="wpsa-category-row-head">
						<strong><?php echo esc_html( (string) $category ); ?></strong>
						<span><?php echo esc_html( (string) $score ); ?>/100</span>
					</div>
					<div class="wpsa-progress">
						<div class="wpsa-progress-bar" style="width: <?php echo esc_attr( (string) max( 0, min( 100, $score ) ) ); ?>%;"></div>
					</div>
				</div>
			<?php endforeach; ?>
		</div>

		<div class="wpsa-card">
			<h2><?php esc_html_e( 'Top 5 Recommended Actions', 'wp-security-saas-alpha' ); ?></h2>
			<ol class="wpsa-priority-list">
				<?php foreach ( (array) ( $latest['top_actions'] ?? array() ) as $action ) : ?>
					<li>
						<strong><?php echo esc_html( (string) ( $action['title'] ?? '' ) ); ?></strong>
						<span class="wpsa-badge wpsa-status-<?php echo esc_attr( (string) ( $action['status'] ?? 'warning' ) ); ?>"><?php echo esc_html( ucfirst( (string) ( $action['status'] ?? 'warning' ) ) ); ?></span>
						- <?php echo esc_html( (string) ( $action['remediation'] ?? '' ) ); ?>
					</li>
				<?php endforeach; ?>
			</ol>
			<p><a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=wpsa-results' ) ); ?>"><?php esc_html_e( 'View Full Scan Results', 'wp-security-saas-alpha' ); ?></a></p>
		</div>
	<?php else : ?>
		<div class="notice notice-info"><p><?php esc_html_e( 'No scans yet. Run the first scan to populate dashboard data.', 'wp-security-saas-alpha' ); ?></p></div>
	<?php endif; ?>
</div>
