<?php
//photo_upload.php

try {

  header('Content-type: application/json');

  //get file name
  $filename = $_POST['filename'];
  $path = $_POST['path'];

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
  } else {
    $bytes = filesize($savePath);
    echo json_encode([
      'message' => "Image uploaded and saved to $savePath ($bytes bytes)"
    ]);
  }
 
} catch (Exception $err) {
  echo json_encode([
    'error' => $err->getMessage()
  ]);
}
?>