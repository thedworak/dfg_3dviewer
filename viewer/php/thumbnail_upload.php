<?php

try {

	header('Content-type: application/json');

	//get file name
	$filename = $_POST['filename'];
	$path = $_POST['path'];
	$wisski_individual = $_POST['wisski_individual'];

	if (!$filename) {
		die(json_encode([
			'error' => "Could not read filename from request"
		]));
	}
	//get image data
	$img = $_FILES['data'];
	if (!$filename || !$path) {
		die(json_encode([
			'error' => "No image data in request"
		]));
	}

	if (!isset($_FILES['data']) || $_FILES['data']['error'] !== UPLOAD_ERR_OK) {
		die(json_encode([
			'error' => "Image upload failed: " . ($_FILES['data']['error'] ?? 'No file')
		]));
	}

	//Create save dir
	$savePath = $path . "views/";
	if (!file_exists($savePath)) {
		if (!mkdir($savePath, 0777, true)) {
			die(json_encode([
				'error' => "Could not create dir $savePath"
			]));
		}
	}
	//Save file
	$savePath .= $filename . '_side45.png';
	if (!move_uploaded_file($img['tmp_name'], $savePath)) {
		echo json_encode([
			'error' => "Could not write to $savePath"
		]);
	} 
	else {
		$bytes = filesize($savePath);
		$params = array(
			'path' => $savePath
		);
		$fields_string = '';
		foreach($params as $key=>$value) { $fields_string .= $key.'='.$value.'&'; }
		rtrim($fields_string, '&');
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $_POST['domain'] . '/' . $wisski_individual . '/savePreview');
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
		curl_setopt($ch, CURLOPT_COOKIE, true);
		curl_setopt($ch, CURLOPT_POST, count($params));
		curl_setopt($ch, CURLOPT_POSTFIELDS, $fields_string);
		$response = curl_exec($ch);
		curl_close($ch);
		if($response !== false) {
			echo json_encode([
				'message' => "Image uploaded and saved to $savePath ($bytes bytes) $response"
			]);
		}
		else {
			echo json_encode([
				'error' => "Curl failed: " . curl_error($ch)
			]);
		}
	}
 
} catch (Exception $err) {
  echo json_encode([
    'error' => $err->getMessage()
  ]);
}
?>