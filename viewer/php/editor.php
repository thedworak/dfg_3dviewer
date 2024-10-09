<?php

if (isset($_POST['5MJQTqB7W4uwBPUe'])) {
	$result = $_POST['5MJQTqB7W4uwBPUe'];
	$path = $_POST['path'];
	$filename = $_POST['filename'];
	file_put_contents($path . "metadata/" . $filename . "_viewer", $result);
} else {
	echo "Permission denied";
}

?>