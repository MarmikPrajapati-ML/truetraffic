<?php
/**
 * Plugin Name: TrueTraffic
 * Plugin URI:  https://github.com/MarmikPrajapati-ML/truetraffic
 * Description: Measures the real human vs. AI-agent share of your traffic. Embeds the TrueTraffic snippet automatically after you paste your Site Key.
 * Version:     1.0.0
 * Author:      Marmik Prajapati
 * Author URI:  https://github.com/MarmikPrajapati-ML
 * License:     GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: truetraffic
 */

defined( 'ABSPATH' ) || exit;

define( 'TRUETRAFFIC_VERSION', '1.0.0' );
define( 'TRUETRAFFIC_OPTION_KEY',       'truetraffic_site_key' );
define( 'TRUETRAFFIC_OPTION_COLLECTOR', 'truetraffic_collector_url' );
define( 'TRUETRAFFIC_DEFAULT_COLLECTOR', 'http://localhost:8001' );

/* ── Admin settings ─────────────────────────────────────────────────────── */

add_action( 'admin_menu', 'truetraffic_add_settings_page' );
function truetraffic_add_settings_page() {
    add_options_page(
        __( 'TrueTraffic Settings', 'truetraffic' ),
        __( 'TrueTraffic', 'truetraffic' ),
        'manage_options',
        'truetraffic',
        'truetraffic_render_settings_page'
    );
}

add_action( 'admin_init', 'truetraffic_register_settings' );
function truetraffic_register_settings() {
    register_setting( 'truetraffic_settings', TRUETRAFFIC_OPTION_KEY,       [ 'sanitize_callback' => 'truetraffic_sanitize_site_key' ] );
    register_setting( 'truetraffic_settings', TRUETRAFFIC_OPTION_COLLECTOR, [ 'sanitize_callback' => 'truetraffic_sanitize_url' ] );
}

function truetraffic_sanitize_site_key( $value ) {
    $value = sanitize_text_field( $value );
    if ( $value !== '' && ! preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $value ) ) {
        add_settings_error( TRUETRAFFIC_OPTION_KEY, 'invalid_uuid', __( 'Site Key must be a valid UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).', 'truetraffic' ) );
        return get_option( TRUETRAFFIC_OPTION_KEY, '' );
    }
    return $value;
}

function truetraffic_sanitize_url( $value ) {
    $clean = esc_url_raw( trim( $value ) );
    return $clean !== '' ? rtrim( $clean, '/' ) : TRUETRAFFIC_DEFAULT_COLLECTOR;
}

function truetraffic_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    // Handle form submission with nonce verification.
    if ( isset( $_POST['_wpnonce'] ) ) {
        check_admin_referer( 'truetraffic_save_settings' );
    }

    $site_key      = get_option( TRUETRAFFIC_OPTION_KEY, '' );
    $collector_url = get_option( TRUETRAFFIC_OPTION_COLLECTOR, TRUETRAFFIC_DEFAULT_COLLECTOR );
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'TrueTraffic Settings', 'truetraffic' ); ?></h1>
        <p>
            <?php esc_html_e( 'TrueTraffic measures the real human vs. AI-agent share of your traffic. Enter your Site Key below and the tracking snippet will be injected automatically on every page.', 'truetraffic' ); ?>
        </p>

        <?php settings_errors(); ?>

        <form method="post" action="options.php">
            <?php
            settings_fields( 'truetraffic_settings' );
            wp_nonce_field( 'truetraffic_save_settings' );
            ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="<?php echo esc_attr( TRUETRAFFIC_OPTION_KEY ); ?>">
                            <?php esc_html_e( 'Site Key', 'truetraffic' ); ?>
                        </label>
                    </th>
                    <td>
                        <input
                            type="text"
                            id="<?php echo esc_attr( TRUETRAFFIC_OPTION_KEY ); ?>"
                            name="<?php echo esc_attr( TRUETRAFFIC_OPTION_KEY ); ?>"
                            value="<?php echo esc_attr( $site_key ); ?>"
                            class="regular-text"
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                        <p class="description">
                            <?php
                            printf(
                                /* translators: %s: URL to TrueTraffic dashboard */
                                esc_html__( 'Get your Site Key from the %s.', 'truetraffic' ),
                                '<a href="http://localhost:5174" target="_blank" rel="noopener noreferrer">' . esc_html__( 'TrueTraffic dashboard', 'truetraffic' ) . '</a>'
                            );
                            ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="<?php echo esc_attr( TRUETRAFFIC_OPTION_COLLECTOR ); ?>">
                            <?php esc_html_e( 'Collector URL', 'truetraffic' ); ?>
                        </label>
                    </th>
                    <td>
                        <input
                            type="url"
                            id="<?php echo esc_attr( TRUETRAFFIC_OPTION_COLLECTOR ); ?>"
                            name="<?php echo esc_attr( TRUETRAFFIC_OPTION_COLLECTOR ); ?>"
                            value="<?php echo esc_attr( $collector_url ); ?>"
                            class="regular-text"
                            placeholder="<?php echo esc_attr( TRUETRAFFIC_DEFAULT_COLLECTOR ); ?>"
                        />
                        <p class="description">
                            <?php esc_html_e( 'URL of your self-hosted TrueTraffic collector API. Leave as default if running locally.', 'truetraffic' ); ?>
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button( __( 'Save Settings', 'truetraffic' ) ); ?>
        </form>

        <?php if ( $site_key ) : ?>
        <hr />
        <h2><?php esc_html_e( 'Status', 'truetraffic' ); ?></h2>
        <p style="color:#16a34a;">
            &#10003; <?php esc_html_e( 'Snippet is active. The tracking script is being injected on every page.', 'truetraffic' ); ?>
        </p>
        <p>
            <strong><?php esc_html_e( 'Snippet preview:', 'truetraffic' ); ?></strong><br />
            <code style="display:block;background:#f6f7f7;padding:8px 12px;margin-top:6px;border-radius:4px;">
                &lt;script src="<?php echo esc_html( $collector_url ); ?>/hs.js"
                data-site-key="<?php echo esc_html( $site_key ); ?>"
                data-collector="<?php echo esc_html( $collector_url ); ?>"&gt;&lt;/script&gt;
            </code>
        </p>
        <?php else : ?>
        <hr />
        <div class="notice notice-warning inline">
            <p><?php esc_html_e( 'No Site Key configured — the snippet is not active. Register your site on the TrueTraffic dashboard and paste the Site Key above.', 'truetraffic' ); ?></p>
        </div>
        <?php endif; ?>
    </div>
    <?php
}

/* ── Admin notice when not configured ──────────────────────────────────── */

add_action( 'admin_notices', 'truetraffic_admin_notice' );
function truetraffic_admin_notice() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    // Suppress notice on the plugin settings page itself.
    $screen = get_current_screen();
    if ( $screen && $screen->id === 'settings_page_truetraffic' ) {
        return;
    }
    if ( get_option( TRUETRAFFIC_OPTION_KEY, '' ) !== '' ) {
        return;
    }
    $settings_url = admin_url( 'options-general.php?page=truetraffic' );
    printf(
        '<div class="notice notice-info is-dismissible"><p>%s <a href="%s">%s</a></p></div>',
        esc_html__( 'TrueTraffic is installed but not yet configured.', 'truetraffic' ),
        esc_url( $settings_url ),
        esc_html__( 'Add your Site Key →', 'truetraffic' )
    );
}

/* ── Snippet injection ──────────────────────────────────────────────────── */

add_action( 'wp_head', 'truetraffic_inject_snippet' );
function truetraffic_inject_snippet() {
    $site_key = get_option( TRUETRAFFIC_OPTION_KEY, '' );
    if ( $site_key === '' ) {
        return;
    }
    $collector_url = get_option( TRUETRAFFIC_OPTION_COLLECTOR, TRUETRAFFIC_DEFAULT_COLLECTOR );
    $snippet_src   = esc_url( trailingslashit( $collector_url ) . 'hs.js' );
    printf(
        "\n<script src=\"%s\" data-site-key=\"%s\" data-collector=\"%s\" defer></script>\n",
        esc_attr( $snippet_src ),
        esc_attr( $site_key ),
        esc_attr( $collector_url )
    );
}
