# Admin panel setup

The repository includes a minimal admin panel at `viewer/admin/` for editing `viewer-settings.json`, `scripts/.env`, managing HDRI and running maintenance tasks.

1. Ensure PHP CLI is installed and the webserver user can write into `viewer/admin/`.

2. Install SQLite support (PHP extension and CLI)

For Debian/Ubuntu:

```bash
sudo apt update
sudo apt install php-sqlite3 sqlite3
```

For RHEL/CentOS/Fedora:

```bash
sudo dnf install php-sqlite3 sqlite
```

After installing the PHP extension, restart your webserver/PHP-FPM:

```bash
sudo systemctl restart apache2        # or nginx + php-fpm
sudo systemctl restart php8.4-fpm     # adjust version as needed
```

Verify installation:

```bash
php -m | grep -i sqlite
sqlite3 --version
```

3. Create the SQLite admin DB and the first admin user (CLI):

```bash
# from repository root
php viewer/admin/create_admin.php <username> <password>

# or from viewer/admin/
php create_admin.php <username> <password>
```

The script will create `viewer/admin/admin.sqlite` automatically and insert the user (passwords are hashed).

4. Open the admin UI in your browser and log in:

```text
http://<host>/viewer/admin/login.php
```

5. Notes & troubleshooting
- The `create_admin.php` script must be run from a shell (CLI). If it fails, verify `php -v` and file permissions.
- The web server (e.g. `www-data`) must have write access to `viewer/admin/admin.sqlite` and to the `viewer/` and `scripts/` paths for saving settings and backups. Example:

```bash
sudo chown -R www-data:www-data viewer/admin viewer scripts
sudo chmod -R 750 viewer/admin viewer scripts
```

- If you need to reset or change the admin password you can either recreate the user with the CLI (delete the old row using `sqlite3`) or edit the DB manually. Example to open DB with sqlite3:

```bash
sqlite3 viewer/admin/admin.sqlite
-- then: SELECT * FROM admins;  DELETE FROM admins WHERE username='...';
```

Security: this admin panel is intentionally minimal. For production use enable HTTPS, restrict access by IP if possible, and consider adding CSRF protection and stronger session handling.
