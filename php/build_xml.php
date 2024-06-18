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

function build_xml ($id) {
	$ID=isset($_GET['id']) ? $_GET['id'] : $argv[1];
	$FILEPATH="sites/default/files/xml_structure/$id.xml";
	//$FILEPATH="/var/www/html/3drepository/modules/dfg_3dviewer/xml_structure/$id.xml";
	//$FILEPATH="/var/www/html/3drepository/sites/default/files/xml_structure/$id.xml";

	//if (!file_exists($FILEPATH)) {
	const DOMAIN = "https://3d-repository.hs-mainz.de";
	$EXPORT_PATH = '/export_xml_single/';
	$url = DOMAIN . $EXPORT_PATH . $id . '?page=0&amp;_format=xml';

	$data = file_get_contents_curl($url);
	$xml = simplexml_load_string($data);

	$xsl = simplexml_load_file("https://raw.githubusercontent.com/slub/dfg-viewer/e54305a9fa58951d3f3d1dd7e64554cb2ee881eb/Resources/Public/XSLT/exportSingleToMetsMods.xsl");
	$xslt = new \XSLTProcessor();
	$xslt->importStyleSheet($xsl);
	
	if(empty($xml));
	  return;
	
	$xmlt = simplexml_load_string($xslt->transformToXML($xml));

	$xmlt->registerXPathNamespace('mets', 'http://www.loc.gov/METS/');
	$xpathResult = $xmlt->xpath('//mets:mets');

	$dom = new DOMDocument('1.0');
	$dom->preserveWhiteSpace = false;
	$dom->formatOutput = true;
	$dom->loadXML($xmlt->asXML());
	$dom->save($FILEPATH);
	//}
}

?>