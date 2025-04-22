<?php

$configFile = 'modules/dfg_3dviewer/viewer/config.json';

if (!file_exists($configFile)) {
	die("Error: Config file not found.");
}

$configData = json_decode(file_get_contents($configFile), true);

if (json_last_error() !== JSON_ERROR_NONE) {
	die("Error decoding JSON: " . json_last_error_msg());
}

$salt = $configData['salt'];

if (isset($_POST[$salt])) {
	$result = $_POST[$salt];
	$path = './'.$_POST['path'];
	$filename = $_POST['filename'];

	file_put_contents($path . "metadata/" . $filename . "_viewer", $result);
} else {
	echo "Permission denied";
}

?>