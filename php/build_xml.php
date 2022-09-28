<?php

function file_get_contents_curl( $url ) {

  $ch = curl_init();

  curl_setopt( $ch, CURLOPT_AUTOREFERER, TRUE );
  curl_setopt( $ch, CURLOPT_HEADER, 0 );
  curl_setopt( $ch, CURLOPT_RETURNTRANSFER, 1 );
  curl_setopt( $ch, CURLOPT_URL, $url );
  curl_setopt( $ch, CURLOPT_FOLLOWLOCATION, TRUE );

  $data = curl_exec( $ch );
  curl_close( $ch );

  return $data;

}

$ID=isset($_GET['id']) ? $_GET['id'] : $argv[1];
$FILEPATH="/var/www/html/3drepository/sites/default/files/xml_structure/$ID.xml";

if (!file_exists($FILEPATH)) {
	$DOMAIN = "https://3d-repository.hs-mainz.de";
	$EXPORT_PATH = '/export_xml_single/';
	$url = $DOMAIN . $EXPORT_PATH . $ID . '?page=0&amp;_format=xml';

	$data = file_get_contents_curl($url);
	$xml = simplexml_load_string($data);
	$xml->registerXPathNamespace('mets', 'http://www.loc.gov/METS/');
	$xpathResult = $xml->xpath('//mets:mets');

	$dom = new DOMDocument('1.0');
	$dom->preserveWhiteSpace = false;
	$dom->formatOutput = true;
	$dom->loadXML($xml->asXML());
	$dom->save($FILEPATH);
}

?>