<?php

const DOMAIN='https://3d-repository.hs-mainz.de';
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

function build_xml ($id) {
	$id = isset($id) ? $id : $_GET['id'];
	$FILEPATH=MFILEPATH."/$id.xml";

	$url = DOMAIN . EXPORT_PATH . $id . '?page=0&amp;_format=xml';

	$data = file_get_contents_curl($url);
	$xml = simplexml_load_string($data);

	if(empty($xml)) return;

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
$arr = array(1,2,3,5,10,20,23,29,31,36,38,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,59,60,61,62,63,65,66,69,71,551,552,77,80,83,92,96,558,1498,1506,1514,1520,1529,1535,1543,1609,1619,1626,1635,1640,1647,1668,1688,1698,1708,1717,1727,1740,1751,1762,1773,1784,1795,1806,1817,1828,1840,1851,1861,1871,1881,1890,1899,1906,1915,1926,1937,1948,1969,1980,1989,1999,2010,2026,2027,2036,2054,2064,2074,2085,2096,2107,2117,2125,2137,2149,2164,2175,2185,2203,2215,2228,2231,2235,2238,2241,2244,2260,2266,2270,2372,2383,2388,2403,2433,2440,2446,2453,2459,2464,2469,2475,2480,2489,2496,2503,2508,2514,2524,2555,2579,2595,2620,2631,2647,2656,2678,2702,2724,2733,2746,2768,2847,2873,2882,2980,3053,3063,3187,3193,3286,3304,3332,3356,3380,3383,3402,3423,3502,3520,3536,3544,3557,3565,3575,3589,3602,3615,3629,3672,3700,3710,3720,3734,3744,3758,3769,3785,3801,3814,3821,3845,3856,3867,3881,3890,3902,3906,3913,3924,3931,3940,3950,3957,3965,3973,3981,3989,3996,4007,4016,4034,4049,4053,4066,4079,4091,4105,4154,4182,4208,4230,4265,4269,4314,4339,4359,4381,4397,4417,4427,4464,4489,4505,4519,4538,4549,4557,4613,4641,4651,4675,4701,4712,4719,4732,4792,4813,4841,4889,4976,4992,5015,5041,5057,5135,5163,5184,5201,5223,5240,5250,5266,5283,5293,5315,5362,5432,5476);
foreach ($arr as &$value) {
    echo "Building XML for $value"
}
//build_xml ($id);

?>