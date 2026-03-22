# Hello World WordPress Plugin

A simple WordPress plugin starter for learning plugin development.

## Features

- ✅ Plugin activation/deactivation hooks
- ✅ Admin notice display
- ✅ Custom shortcode `[hello_world]`
- ✅ Text domain support for translations
- ✅ Proper plugin header with metadata

## Installation

1. Download or clone this repository to `/wp-content/plugins/`
2. Name the folder `hello-world-plugin`
3. Go to WordPress admin → Plugins
4. Activate "Hello World"

## Usage

Use the shortcode in any post or page:

```
[hello_world]
```

This will display: "Hello World! This is my first WordPress plugin."

## File Structure

```
hello-world-plugin/
├── hello-world.php          # Main plugin file
├── readme.txt               # WordPress plugin readme
├── LICENSE.txt              # GPL-2.0+ license
└── README.md                # This file
```

## How to Extend

Edit `hello-world.php` to:

- Add more functions
- Create admin pages
- Add custom post types
- Register custom taxonomies
- Add settings pages

## Requirements

- WordPress 5.0+
- PHP 7.2+

## License

GPL-2.0+

## Author

Your Name

---

**Happy coding! 🎉**
