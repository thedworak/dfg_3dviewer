<?php

const EXPORT_PATH='/export_xml_single/';
const MFILEPATH='sites/default/files/xml_structure';
const XSLURL="https://raw.githubusercontent.com/slub/dfg-viewer/e54305a9fa58951d3f3d1dd7e64554cb2ee881eb/Resources/Public/XSLT/exportSingleToMetsMods.xsl";
libxml_use_internal_errors(true); // Suppress default XML errors

function file_get_content_curl( $url ) {
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

function normalize_domain(string $domain): string {
	$domain = trim($domain);
	if ($domain === '') {
		return '';
	}
	if (!preg_match('#^https?://#i', $domain)) {
		$domain = 'https://' . $domain;
	}
	return rtrim($domain, '/');
}

function normalize_default_host_urls(string $xml, string $domain): string {
	if ($domain === '') {
		return $xml;
	}

	$normalized = preg_replace('#https?://(default|dfg_3dviewer)(?=/)#i', $domain, $xml);

	/*
	  Avoid duplicated host prefixes in malformed paths, e.g.
	  https://host/sites/default/files/wisski_original/https://host/...
	*/
	$escaped = preg_quote($domain, '#');
	$normalized = preg_replace(
		"#{$escaped}/sites/default/files/wisski_original/{$escaped}#i",
		$domain,
		$normalized
	);
	$normalized = preg_replace(
		"#https?://[^/]+/sites/default/files/wisski_original/{$escaped}#i",
		$domain,
		$normalized
	);

	return $normalized;
}

function build_xml ($id, $domain) {
	$id = isset($id) ? $id : $_GET['id'];
	$domain = isset($domain) ? $domain : $_GET['domain'];
	$domain = normalize_domain((string) $domain);
	$FILEPATH=MFILEPATH."/$id.xml";

	if ($domain === '') {
		return;
	}

	$query = http_build_query(['page' => 0, '_format' => 'xml']);
	$url = $domain . EXPORT_PATH . $id . '?' . $query;

	$data = file_get_content_curl($url);
	if (!is_string($data) || $data === '') {
		return;
	}

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
		$result = normalize_default_host_urls($result, $domain);
		$xmlt = simplexml_load_string($result);
		if ($xmlt === false) {
			return;
		}

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
