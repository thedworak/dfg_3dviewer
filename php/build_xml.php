<?php

const EXPORT_PATH='/export_xml_single/';
const MFILEPATH='sites/default/files/xml_structure';
const XSLURL="https://raw.githubusercontent.com/slub/dfg-viewer/e54305a9fa58951d3f3d1dd7e64554cb2ee881eb/Resources/Public/XSLT/exportSingleToMetsMods.xsl";

function file_get_contents_curl( $url ) {
	$ch = curl_init();

	curl_setopt( $ch, CURLOPT_AUTOREFERER, TRUE );
	curl_setopt( $ch, CURLOPT_HEADER, 0 );
	curl_setopt( $ch, CURLOPT_RETURNTRANSFER, 1 );
	curl_setopt( $ch, CURLOPT_URL, $url );
	curl_setopt( $ch, CURLOPT_FOLLOWLOCATION, TRUE );
	curl_setopt( $ch, CURLOPT_SSL_VERIFYPEER, false);

	$data = curl_exec( $ch );
	
	curl_close( $ch );

	if($data === false) {
		echo 'Curl ERROR: ' . curl_error($ch);
	} else
	{
		return $data;
	}

}

function build_xml ($id, $domain) {
	$id = isset($id) ? $id : $_GET['id'];
	$domain = isset($domain) ? $domain : $_GET['domain'];
	$FILEPATH=MFILEPATH."/$id.xml";

	$url = $domain . EXPORT_PATH . $id . '?page=0&amp;_format=xml';

	$data = file_get_contents_curl($url);
	$xml = simplexml_load_string($data);

	if(!empty($xml)) return;

	$xsl = simplexml_load_file(XSLURL);
	$xslt = new \XSLTProcessor();
	$xslt->importStyleSheet($xsl);

	$xmlt = simplexml_load_string($xslt->transformToXML($xml));

	$xmlt->registerXPathNamespace('mets', 'http://www.loc.gov/METS/');
	$xpathResult = $xmlt->xpath('//mets:mets');
	echo $xmlt;

	$dom = new DOMDocument('1.0');
	$dom->preserveWhiteSpace = false;
	$dom->formatOutput = true;
	$dom->loadXML($xmlt->asXML());
	$dom->save($FILEPATH);
}

#$id = isset($entity_id) ? $entity_id : $_GET['id'];
#$domain = isset($domain) ? $domain : $_GET['domain'];
#build_xml ($id);

?>