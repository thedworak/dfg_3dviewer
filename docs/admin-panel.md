# Admin panel

The repository ships an optional, intentionally minimal PHP admin panel at `viewer/admin/` for
editing `viewer-settings.json`, the conversion `scripts/.env`, managing HDRI environment maps,
viewing backups and running maintenance tasks.

!!! note "Bundled only with self-hosted builds"
    The admin panel is copied into `dev`, `test` and Drupal `custom` builds. It is **not**
    included in `prod` or the minified Drupal `main` build. See [Build targets](build-targets.md).

## Files

| File | Purpose |
|------|---------|
| `viewer/admin/index.php` | Panel entry point |
| `viewer/admin/login.php` / `logout.php` | Session login/logout |
| `viewer/admin/create_admin.php` | CLI script to create the SQLite DB and first admin user |
| `viewer/admin/db.php` | SQLite connection helper |
| `viewer/admin/settings.php` | Settings editor UI |
| `viewer/admin/env.php` | `.env` editor UI |
| `viewer/admin/hdri.php` | HDRI environment-map management |
| `viewer/admin/actions.php` | Maintenance actions |
| `viewer/admin/api/` | JSON endpoints (`settings`, `env`, `hdri`, `backups`, `actions`, schemas) |
| `viewer/admin/style.css` | Panel styling |

## Setup

### 1. Requirements

Ensure PHP CLI is installed and the web server user can write into `viewer/admin/`. The panel
uses SQLite, so install the PHP extension and CLI tool:

```bash
# Debian/Ubuntu
sudo apt update
sudo apt install php-sqlite3 sqlite3

# RHEL/CentOS/Fedora
sudo dnf install php-sqlite3 sqlite
```

Restart your web server / PHP-FPM after installing the extension:

```bash
sudo systemctl restart apache2        # or nginx + php-fpm
sudo systemctl restart php8.4-fpm     # adjust version as needed
```

Verify:

```bash
php -m | grep -i sqlite
sqlite3 --version
```

### 2. Create the admin database and first user

Run from a shell (CLI). The script creates `viewer/admin/admin.sqlite` automatically and inserts
the user with a hashed password:

```bash
# from repository root
php viewer/admin/create_admin.php <username> <password>

# or from viewer/admin/
php create_admin.php <username> <password>
```

### 3. Log in

```text
http://<host>/viewer/admin/login.php
```

## Permissions

The web server user (e.g. `www-data`) must be able to write `viewer/admin/admin.sqlite` and the
`viewer/` path for saving settings and backups:

```bash
sudo chown -R www-data:www-data viewer/admin viewer
sudo chmod -R 750 viewer/admin viewer
```

## Resetting the admin password

Recreate the user via the CLI, or edit the DB directly:

```bash
sqlite3 viewer/admin/admin.sqlite
-- then:  SELECT * FROM admins;
--        DELETE FROM admins WHERE username='...';
```

!!! warning "Security"
    This admin panel is deliberately minimal. For production use, enable HTTPS, restrict access
    by IP where possible, and consider CSRF protection and stronger session handling. The build
    removes any developer `admin/admin.sqlite` from the output so it is never published.
