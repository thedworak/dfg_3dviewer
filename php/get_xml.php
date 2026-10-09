<?php

$ID=isset($_GET['id']) ? $_GET['id'] : $argv[1];
$FILEPATH="/var/www/html/3drepository/sites/default/files/xml_structure/$ID.xml";

if (file_exists($FILEPATH)) {
	$data = file_get_contents("/var/www/html/3drepository/sites/default/files/xml_structure/$ID.xml");
	echo $data;
}
?>