<?php

use Drupal\Core\Url;
use Symfony\Component\HttpFoundation\Request;

const EXPORT_PATH='/export_xml_single/';
const MFILEPATH='sites/default/files/xml_structure';
const XSLURL="https://raw.githubusercontent.com/slub/dfg-viewer/e54305a9fa58951d3f3d1dd7e64554cb2ee881eb/Resources/Public/XSLT/exportSingleToMetsMods.xsl";
libxml_use_internal_errors(true); // Suppress default XML errors

function build_xml ($id, $domain) {
	$id = isset($id) ? $id : $_GET['id'];
	$domain = isset($domain) ? $domain : $_GET['domain'];
	$FILEPATH=MFILEPATH."/$id.xml";

	$url = Url::fromUri('internal:' . EXPORT_PATH . $id, [
		'query' => ['page' => 0, '_format' => 'xml'],
		'absolute' => FALSE,
	])->toString();

	$kernel = \Drupal::service('http_kernel');
	$request = Request::create($url, 'GET');

	$response = $kernel->handle($request);
	$data = $response->getContent();

	$xml = simplexml_load_string($data);

	if (empty($xml) || !is_object($xml)) {
		return;
	}

	$xsl = simplexml_load_file(XSLURL);
	$xslt = new \XSLTProcessor();
	$xslt->importStyleSheet($xsl);

	$result = $xslt->transformToXML($xml);
	if ($result === false) {
		echo "XSLT Transformation failed.\n";
	} else {
		$xmlt = simplexml_load_string($result);

		$xmlt->registerXPathNamespace('mets', 'http://www.loc.gov/METS/');
		$xpathResult = $xmlt->xpath('//mets:mets');
		echo $xmlt;

		$dom = new DOMDocument('1.0');
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput = true;
		$dom->loadXML($xmlt->asXML());
		$dom->save($FILEPATH);
	}
}

#$id = isset($entity_id) ? $entity_id : $_GET['id'];
#$domain = isset($domain) ? $domain : $_GET['domain'];
#build_xml ($id);

?>