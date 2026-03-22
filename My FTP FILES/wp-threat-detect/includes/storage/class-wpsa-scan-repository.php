<?php
/**
 * Scan history repository.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Scan_Repository {

	/**
	 * Returns scan table name.
	 *
	 * @return string
	 */
	public function get_table_name() {
		global $wpdb;
		return $wpdb->prefix . 'wpsa_scans';
	}

	/**
	 * Creates the scan table.
	 *
	 * @return void
	 */
	public function maybe_create_table() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table   = $this->get_table_name();
		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			scan_uuid VARCHAR(64) NOT NULL,
			trigger_source VARCHAR(20) NOT NULL,
			overall_score SMALLINT(5) NOT NULL DEFAULT 0,
			status_counts LONGTEXT NOT NULL,
			category_scores LONGTEXT NOT NULL,
			top_actions LONGTEXT NOT NULL,
			findings LONGTEXT NOT NULL,
			site_profile_snapshot LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY (id),
			KEY scan_uuid (scan_uuid),
			KEY created_at (created_at)
		) {$charset};";

		dbDelta( $sql );
	}

	/**
	 * Insert scan record.
	 *
	 * @param array<string,mixed> $record Record payload.
	 * @return int
	 */
	public function insert_scan( $record ) {
		global $wpdb;

		$wpdb->insert(
			$this->get_table_name(),
			array(
				'scan_uuid'             => sanitize_text_field( $record['scan_uuid'] ),
				'trigger_source'        => sanitize_key( $record['trigger_source'] ),
				'overall_score'         => (int) $record['overall_score'],
				'status_counts'         => wp_json_encode( $record['status_counts'] ),
				'category_scores'       => wp_json_encode( $record['category_scores'] ),
				'top_actions'           => wp_json_encode( $record['top_actions'] ),
				'findings'              => wp_json_encode( $record['findings'] ),
				'site_profile_snapshot' => wp_json_encode( $record['site_profile_snapshot'] ),
				'created_at'            => gmdate( 'Y-m-d H:i:s' ),
			),
			array( '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s' )
		);

		return (int) $wpdb->insert_id;
	}

	/**
	 * Get latest scan.
	 *
	 * @return array<string,mixed>|null
	 */
	public function get_latest_scan() {
		global $wpdb;
		$row = $wpdb->get_row( "SELECT * FROM {$this->get_table_name()} ORDER BY id DESC LIMIT 1", ARRAY_A );
		return $this->hydrate_row( $row );
	}

	/**
	 * Get scan history.
	 *
	 * @param int $limit Max results.
	 * @return array<int,array<string,mixed>>
	 */
	public function get_scan_history( $limit = 25 ) {
		global $wpdb;
		$limit = max( 1, min( 200, (int) $limit ) );
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$this->get_table_name()} ORDER BY id DESC LIMIT %d", $limit ), ARRAY_A );

		$history = array();
		foreach ( $rows as $row ) {
			$item = $this->hydrate_row( $row );
			if ( null !== $item ) {
				$history[] = $item;
			}
		}
		return $history;
	}

	/**
	 * Hydrate DB row.
	 *
	 * @param array<string,mixed>|null $row DB row.
	 * @return array<string,mixed>|null
	 */
	private function hydrate_row( $row ) {
		if ( ! is_array( $row ) ) {
			return null;
		}

		$row['status_counts']         = json_decode( (string) $row['status_counts'], true );
		$row['category_scores']       = json_decode( (string) $row['category_scores'], true );
		$row['top_actions']           = json_decode( (string) $row['top_actions'], true );
		$row['findings']              = json_decode( (string) $row['findings'], true );
		$row['site_profile_snapshot'] = json_decode( (string) $row['site_profile_snapshot'], true );

		return $row;
	}

	/**
	 * Drops table during uninstall.
	 *
	 * @return void
	 */
	public function drop_table() {
		global $wpdb;
		$wpdb->query( "DROP TABLE IF EXISTS {$this->get_table_name()}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}
}
