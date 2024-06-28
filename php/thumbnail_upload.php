<?php
//thumbnail_upload.php

#use Drupal\Core\Routing\RouteMatchInterface;
#use Drupal\Core\Form\FormStateInterface;
#use Drupal\Core\Template\Attribute;
#use Drupal\Core\Url;
#use Drupal\image\Entity\ImageStyle;
#use Drupal\Core\Archiver\Zip;
#use Drupal\Core\Archiver\ArchiverException;

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
	//Create save dir
	$savePath = $path . "views/";
	if (!file_exists($savePath)) {
		if (!mkdir($savePath)) {
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
		curl_setopt($ch, CURLOPT_URL, 'https://3d-repository.hs-mainz.de/wisski/dfg_3dviewer/' . $wisski_individual . '/savePreview');
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
	}
 
} catch (Exception $err) {
  echo json_encode([
    'error' => $err->getMessage()
  ]);
}
?>