#!/usr/bin/env bash

FILENAME="/var/www/html/3drepository/sites/default/settings.php"

test -f ../.env && source "$_"

DATABASE=$(php -r "error_reporting(0); \$filename = '$FILENAME'; error_reporting(0); (require(\$filename)); echo \$databases[\"default\"][\"default\"][\"database\"];")
DATABASE_HOST=$(php -r "error_reporting(0); \$filename = '$FILENAME'; error_reporting(0); (require(\$filename)); echo \$databases[\"default\"][\"default\"][\"host\"];")
DATABASE_PASS=$(php -r "error_reporting(0); \$filename = '$FILENAME'; error_reporting(0); (require(\$filename)); echo \$databases[\"default\"][\"default\"][\"password\"];")
DATABASE_USER=$(php -r "error_reporting(0); \$filename = '$FILENAME'; error_reporting(0); (require(\$filename)); echo \$databases[\"default\"][\"default\"][\"username\"];")