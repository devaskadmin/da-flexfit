<?php
/**
 * History view.
 *
 * @var array<int,array<string,mixed>> $history
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap wpsa-wrap">
	<h1><?php esc_html_e( 'Scan History', 'wp-security-saas-alpha' ); ?></h1>

	<table class="widefat striped">
		<thead>
			<tr>
				<th><?php esc_html_e( 'ID', 'wp-security-saas-alpha' ); ?></th>
				<th><?php esc_html_e( 'Date (UTC)', 'wp-security-saas-alpha' ); ?></th>
				<th><?php esc_html_e( 'Trigger', 'wp-security-saas-alpha' ); ?></th>
				<th><?php esc_html_e( 'Score', 'wp-security-saas-alpha' ); ?></th>
				<th><?php esc_html_e( 'Pass', 'wp-security-saas-alpha' ); ?></th>
				<th><?php esc_html_e( 'Warning', 'wp-security-saas-alpha' ); ?></th>
				<th><?php esc_html_e( 'Fail', 'wp-security-saas-alpha' ); ?></th>
			</tr>
		</thead>
		<tbody>
			<?php if ( empty( $history ) ) : ?>
				<tr><td colspan="7"><?php esc_html_e( 'No scan history yet.', 'wp-security-saas-alpha' ); ?></td></tr>
			<?php else : ?>
				<?php foreach ( $history as $row ) : ?>
					<tr>
						<td><?php echo esc_html( (string) $row['id'] ); ?></td>
						<td><?php echo esc_html( (string) $row['created_at'] ); ?></td>
						<td><?php echo esc_html( (string) $row['trigger_source'] ); ?></td>
						<td><?php echo esc_html( (string) $row['overall_score'] ); ?></td>
						<td><?php echo esc_html( (string) ( $row['status_counts']['pass'] ?? 0 ) ); ?></td>
						<td><?php echo esc_html( (string) ( $row['status_counts']['warning'] ?? 0 ) ); ?></td>
						<td><?php echo esc_html( (string) ( $row['status_counts']['fail'] ?? 0 ) ); ?></td>
					</tr>
				<?php endforeach; ?>
			<?php endif; ?>
		</tbody>
	</table>
</div>
