=== Hello World ===
Contributors: Your Name
Tags: hello, world, example
Stable Tag: 1.0.0
Tested up to: 6.5
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.txt

A simple Hello World WordPress plugin to demonstrate plugin development.

== Description ==

Hello World is a basic WordPress plugin that demonstrates plugin fundamentals including:

- Plugin activation and deactivation hooks
- Admin notices
- Custom shortcodes
- Text domain for translations

Use the `[hello_world]` shortcode anywhere in your posts or pages to display the Hello World message.

== Installation ==

1. Upload the `hello-world-plugin` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Use the `[hello_world]` shortcode in your posts or pages

== Usage ==

Add this shortcode to any post or page:
```
[hello_world]
```

== Frequently Asked Questions ==

= Can I customize the output? =
Yes! You can modify the `hello_world_shortcode()` function in hello-world.php to customize the output.

== Changelog ==

= 1.0.0 =
* Initial release

== License ==

This plugin is licensed under the GPL-2.0+ License.
See LICENSE.txt for more information.
