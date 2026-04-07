<?php

namespace Drupal\dfg_3dviewer\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\File\FileSystemInterface;
use GuzzleHttp\ClientInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\DependencyInjection\ContainerInterface;

class XmlExportController extends ControllerBase {

  private const XSL_URL = 'https://raw.githubusercontent.com/slub/dfg-viewer/e54305a9fa58951d3f3d1dd7e64554cb2ee881eb/Resources/Public/XSLT/exportSingleToMetsMods.xsl';
  private const JSON_EXPORT_PATH = '/api/digital_reconstruction/record/%d';
  private const EXPORT_PATHS = [
    '/wisski/navigate/%d/view',
    '/export_xml_single/%d',
  ];
  private const FILE_DIR = 'public://xml_structure';

  protected ClientInterface $httpClient;
  protected FileSystemInterface $fileSystem;

  public function __construct(
    ClientInterface $http_client,
    FileSystemInterface $file_system
  ) {
    $this->httpClient = $http_client;
    $this->fileSystem = $file_system;
  }

  public static function create(ContainerInterface $container): self {
    return new static(
      $container->get('http_client'),
      $container->get('file_system')
    );
  }

  /**
   * Route callback.
   */
  public function export(Request $request, ?string $id = null): Response {
    $content = trim((string) $request->getContent());
    $domain = null;

    if ($request->isMethod('GET')) {
      $domain = trim((string) $request->query->get('domain', ''));
    }
    elseif ($content !== '' && $this->isJson($content)) {
      $data = json_decode($content, true);
      $id = $id ?? ($data['id'] ?? null);
      $domain = trim((string) ($data['domain'] ?? ''));
      if ($domain === '') {
        return new Response('Missing domain', 400);
      }
    }

    if (!$id) {
      return new Response('Missing id', 400);
    }

    if ($request->isMethod('GET') && !$domain) {
      return new Response('Missing domain', 400);
    }

    try {
      $result = $this->buildExportXml($request, (int) $id, (string) $domain);
      $this->saveXml((string) $id, $result);

      return new Response(
        $result,
        200,
        ['Content-Type' => 'application/xml; charset=UTF-8']
      );
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->error($e->getMessage());
      return new Response('XML export failed', 500);
    }
  }


  protected function isJson(string $content): bool {
    json_decode($content);
    return json_last_error() === JSON_ERROR_NONE;
  }


  /**
   * Builds export XML from request body, legacy XML source or JSON API source.
   */
  protected function buildExportXml(Request $request, int $id, string $domain): string {
    $xmlString = trim($request->getContent() ?? '');
    if ($xmlString !== '') {
      libxml_use_internal_errors(true);
      $xml = simplexml_load_string($xmlString);
      if ($xml instanceof \SimpleXMLElement) {
        return $this->transformXml($xml, $domain);
      }
    }

    try {
      $xml = $this->fetchSourceXmlFromDomain($id, $domain);
      return $this->transformXml($xml, $domain);
    }
    catch (\Throwable $legacyException) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Legacy XML source fetch failed for @id, trying JSON fallback: @msg',
        [
          '@id' => (string) $id,
          '@msg' => $legacyException->getMessage(),
        ]
      );
    }

    $record = $this->fetchJsonRecordFromDomain($id, $domain);
    $record = $this->enrichJsonRecordFromLocalEntity($record, $id);
    return $this->buildXmlFromJsonRecord($record, $id, $domain);
  }

  protected function fetchSourceXmlFromDomain(int $id, string $domain): \SimpleXMLElement {
    $domain = $this->normalizeDomain($domain);
    if ($domain === '') {
      throw new \RuntimeException('Missing domain for XML source fetch');
    }

    $query = http_build_query(['page' => 0, '_format' => 'xml']);
    $attempts = [];

    foreach (self::EXPORT_PATHS as $pattern) {
      $url = $domain . sprintf($pattern, $id) . '?' . $query;
      try {
        $response = $this->httpClient->request('GET', $url, ['http_errors' => false]);
      }
      catch (\Throwable $e) {
        $attempts[] = sprintf('%s => exception: %s', $url, $e->getMessage());
        continue;
      }

      $status = $response->getStatusCode();
      $attempts[] = sprintf('%s => %d', $url, $status);
      if ($status !== 200) {
        continue;
      }

      $xmlString = (string) $response->getBody();
      if ($xmlString === '') {
        $attempts[] = sprintf('%s => empty body', $url);
        continue;
      }

      libxml_use_internal_errors(true);
      $xml = simplexml_load_string($xmlString);
      if ($xml instanceof \SimpleXMLElement) {
        return $xml;
      }
      $attempts[] = sprintf('%s => invalid XML', $url);
    }

    \Drupal::logger('dfg_3dviewer')->error('XML source fetch failed; attempts: @attempts', ['@attempts' => implode('; ', $attempts)]);
    throw new \RuntimeException('Cannot fetch source XML from domain');
  }

  protected function normalizeDomain(string $domain): string {
    $domain = trim($domain);
    if ($domain === '') {
      return '';
    }
    if (!preg_match('#^https?://#i', $domain)) {
      $domain = 'https://' . $domain;
    }
    return rtrim($domain, '/');
  }

  protected function fetchJsonRecordFromDomain(int $id, string $domain): array {
    $json_base_url = trim((string) (
      $this->config('dfg_3dviewer.settings')->get('dfg_3dviewer_json_export_base_url')
      ?? $this->config('dfg_3dviewer.settings')->get('json_export_base_url')
      ?? ''
    ));
    $source = trim($json_base_url !== '' ? $json_base_url : $domain);
    $url = $this->resolveJsonRecordUrl($source, $id);
    if ($url === '') {
      throw new \RuntimeException('Missing base URL for JSON source fetch');
    }

    $response = $this->httpClient->request('GET', $url, ['http_errors' => false]);
    if ($response->getStatusCode() !== 200) {
      throw new \RuntimeException('JSON source fetch failed with status ' . $response->getStatusCode());
    }

    $payload = json_decode((string) $response->getBody(), true);
    if (!is_array($payload)) {
      throw new \RuntimeException('JSON source returned invalid payload');
    }

    $record = $payload[0] ?? $payload;
    if (!is_array($record) || empty($record)) {
      throw new \RuntimeException('JSON source returned an empty record');
    }

    return $record;
  }

  protected function resolveJsonRecordUrl(string $source, int $id): string {
    $source = trim($source);
    if ($source === '') {
      return '';
    }

    if (preg_match('#/api/digital_reconstruction/record/\d+/?$#', $source)) {
      return rtrim($source, '/');
    }

    if (preg_match('#/api/digital_reconstruction/record/?$#', $source)) {
      return rtrim($source, '/') . '/' . $id;
    }

    $base_url = $this->normalizeDomain($source);
    if ($base_url === '') {
      return '';
    }

    return $base_url . sprintf(self::JSON_EXPORT_PATH, $id);
  }

  /**
   * Transform XML using XSLT.
   */
  protected function transformXml(\SimpleXMLElement $xml, string $domain): string {
    $xsl = simplexml_load_string($this->fetchXsl());
    if (!$xsl) {
      throw new \RuntimeException('Cannot load XSL');
    }

    $xslt = new \XSLTProcessor();
    $xslt->importStyleSheet($xsl);

    $result = $xslt->transformToXML($xml);
    if ($result === false) {
      throw new \RuntimeException('XSLT transformation failed');
    }

    $result = $this->normalizeDefaultHostUrls($result, $domain);
    return $this->formatXml($result);
  }

  protected function buildXmlFromJsonRecord(array $record, int $id, string $domain): string {
    $domain = $this->normalizeDomain($domain);
    $title = $this->stringValue($record, 'title', 'Digital reconstruction ' . $id);
    $converted_file = $this->extractModelUrlFromRecord($record);
    if ($converted_file === '') {
      throw new \RuntimeException(
        'JSON record does not contain a 3D file URL. Available keys: ' . implode(', ', array_keys($record))
      );
    }

    $preview = $this->firstNonEmptyValue($record, ['object_preview', 'preview', 'reconstruction_previews']);
    $metadata_export = $this->firstNonEmptyValue($record, ['metadata_export']);
    $object_uri = $this->firstNonEmptyValue($record, ['object_URI', 'URI']);
    $description = $this->firstNonEmptyValue($record, ['object_description']);
    $authors = $this->firstNonEmptyValue($record, ['reconstruction_authors']);
    $authors_affiliation = $this->firstNonEmptyValue($record, ['reconstruction_authors_affiliation']);
    $license = $this->firstNonEmptyValue($record, ['reconstruction_license']);
    $time_frame = $this->firstNonEmptyValue($record, ['reconstruction_time_frame']);
    $edition_date = $this->firstNonEmptyValue($record, ['edition_date']);
    $object_name = $this->firstNonEmptyValue($record, ['object_name']);
    $object_type = $this->firstNonEmptyValue($record, ['object_type']);
    $object_category = $this->firstNonEmptyValue($record, ['object_category']);
    $project_name = $this->firstNonEmptyValue($record, ['project_name']);
    $project_acronym = $this->firstNonEmptyValue($record, ['project_acronym']);
    $custody = $this->firstNonEmptyValue($record, ['reconstruction_custody']);
    $status = $this->firstNonEmptyValue($record, ['status']);

    $dom = new \DOMDocument('1.0', 'UTF-8');
    $dom->preserveWhiteSpace = false;
    $dom->formatOutput = true;

    $mets = $dom->createElementNS('http://www.loc.gov/METS/', 'mets:mets');
    $mets->setAttribute('OBJID', (string) $id);
    $mets->setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:mods', 'http://www.loc.gov/mods/v3');
    $mets->setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
    $dom->appendChild($mets);

    $metsHdr = $dom->createElement('mets:metsHdr');
    if ($edition_date !== '') {
      $metsHdr->setAttribute('LASTMODDATE', $edition_date);
    }
    $mets->appendChild($metsHdr);

    $dmdSec = $dom->createElement('mets:dmdSec');
    $dmdSec->setAttribute('ID', 'DMD1');
    $mets->appendChild($dmdSec);

    $mdWrap = $dom->createElement('mets:mdWrap');
    $mdWrap->setAttribute('MDTYPE', 'MODS');
    $dmdSec->appendChild($mdWrap);

    $xmlData = $dom->createElement('mets:xmlData');
    $mdWrap->appendChild($xmlData);

    $mods = $dom->createElement('mods:mods');
    $xmlData->appendChild($mods);

    $titleInfo = $dom->createElement('mods:titleInfo');
    $mods->appendChild($titleInfo);
    $titleInfo->appendChild($dom->createElement('mods:title', $title));

    foreach ([
      'reconstruction_authors' => $authors,
      'reconstruction_authors_affiliation' => $authors_affiliation,
      'object_name' => $object_name,
      'object_type' => $object_type,
      'object_category' => $object_category,
      'project_name' => $project_name,
      'project_acronym' => $project_acronym,
      'reconstruction_custody' => $custody,
      'status' => $status,
      'reconstruction_time_frame' => $time_frame,
    ] as $label => $value) {
      if ($value === '') {
        continue;
      }
      $note = $dom->createElement('mods:note', $value);
      $note->setAttribute('type', $label);
      $mods->appendChild($note);
    }

    if ($authors !== '') {
      $name = $dom->createElement('mods:name');
      $name->setAttribute('type', 'personal');
      $mods->appendChild($name);
      $name->appendChild($dom->createElement('mods:namePart', $authors));
      $role = $dom->createElement('mods:role');
      $name->appendChild($role);
      $role->appendChild($dom->createElement('mods:roleTerm', 'creator'));
    }

    if ($description !== '') {
      $mods->appendChild($dom->createElement('mods:abstract', $description));
    }

    if ($license !== '') {
      $mods->appendChild($dom->createElement('mods:accessCondition', $license));
    }

    if ($edition_date !== '') {
      $originInfo = $dom->createElement('mods:originInfo');
      $originInfo->appendChild($dom->createElement('mods:dateIssued', $edition_date));
      $mods->appendChild($originInfo);
    }

    if ($object_uri !== '' || $metadata_export !== '' || $domain !== '') {
      $location = $dom->createElement('mods:location');
      $mods->appendChild($location);
      if ($object_uri !== '') {
        $location->appendChild($dom->createElement('mods:url', $object_uri));
      }
      if ($metadata_export !== '') {
        $url = $dom->createElement('mods:url', $metadata_export);
        $url->setAttribute('usage', 'primary display');
        $location->appendChild($url);
      }
      if ($domain !== '') {
        $location->appendChild($dom->createElement('mods:physicalLocation', $domain));
      }
    }

    $fileSec = $dom->createElement('mets:fileSec');
    $mets->appendChild($fileSec);

    $modelGroup = $dom->createElement('mets:fileGrp');
    $modelGroup->setAttribute('USE', 'MODEL');
    $fileSec->appendChild($modelGroup);

    $modelFile = $dom->createElement('mets:file');
    $modelFile->setAttribute('ID', 'FILE_MODEL');
    $modelFile->setAttribute('MIMETYPE', $this->guessMimeTypeFromUrl($converted_file));
    $modelGroup->appendChild($modelFile);

    $modelFLocat = $dom->createElement('mets:FLocat');
    $modelFLocat->setAttribute('LOCTYPE', 'URL');
    $modelFLocat->setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', $converted_file);
    $modelFile->appendChild($modelFLocat);

    if ($preview !== '') {
      $thumbGroup = $dom->createElement('mets:fileGrp');
      $thumbGroup->setAttribute('USE', 'THUMBNAIL');
      $fileSec->appendChild($thumbGroup);

      $thumbFile = $dom->createElement('mets:file');
      $thumbFile->setAttribute('ID', 'FILE_PREVIEW');
      $thumbFile->setAttribute('MIMETYPE', $this->guessMimeTypeFromUrl($preview));
      $thumbGroup->appendChild($thumbFile);

      $thumbFLocat = $dom->createElement('mets:FLocat');
      $thumbFLocat->setAttribute('LOCTYPE', 'URL');
      $thumbFLocat->setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', $preview);
      $thumbFile->appendChild($thumbFLocat);
    }

    $structMap = $dom->createElement('mets:structMap');
    $structMap->setAttribute('TYPE', 'LOGICAL');
    $mets->appendChild($structMap);

    $div = $dom->createElement('mets:div');
    $div->setAttribute('TYPE', 'monograph');
    $div->setAttribute('DMDID', 'DMD1');
    $div->setAttribute('LABEL', $title);
    $structMap->appendChild($div);

    $fptr = $dom->createElement('mets:fptr');
    $fptr->setAttribute('FILEID', 'FILE_MODEL');
    $div->appendChild($fptr);

    $amdSec = $dom->createElement('mets:amdSec');
    $mets->appendChild($amdSec);
    $techMD = $dom->createElement('mets:techMD');
    $techMD->setAttribute('ID', 'TECH1');
    $amdSec->appendChild($techMD);
    $techWrap = $dom->createElement('mets:mdWrap');
    $techWrap->setAttribute('MDTYPE', 'OTHER');
    $techWrap->setAttribute('OTHERMDTYPE', 'DFG3D');
    $techMD->appendChild($techWrap);
    $techXmlData = $dom->createElement('mets:xmlData');
    $techWrap->appendChild($techXmlData);
    $techXmlData->appendChild($dom->createElement('converted_file', $converted_file));
    if ($preview !== '') {
      $techXmlData->appendChild($dom->createElement('object_preview', $preview));
    }
    if ($metadata_export !== '') {
      $techXmlData->appendChild($dom->createElement('metadata_export', $metadata_export));
    }

    $xml = $dom->saveXML();
    if ($xml === false) {
      throw new \RuntimeException('Cannot build XML from JSON record.');
    }

    $xml = $this->normalizeDefaultHostUrls($xml, $domain);
    return $this->formatXml($xml);
  }

  protected function enrichJsonRecordFromLocalEntity(array $record, int $id): array {
    $current_model = $this->extractModelUrlFromRecord($record);
    if ($current_model !== '') {
      if ($this->stringValue($record, '3D_file') === '') {
        $record['3D_file'] = $current_model;
        $source = $this->detectModelSourceInRecord($record);
        \Drupal::logger('dfg_3dviewer')->notice(
          'Filled missing JSON 3D_file for entity @id from existing record source "@source": @value',
          [
            '@id' => (string) $id,
            '@source' => $source,
            '@value' => $current_model,
          ]
        );
      }
      return $record;
    }

    $cfg = $this->config('dfg_3dviewer.settings');
    $field_candidates = array_values(array_filter([
      trim((string) ($cfg->get('dfg_3dviewer_api_3d_file_field') ?? $cfg->get('api_3d_file_field') ?? '')),
      trim((string) ($cfg->get('dfg_3dviewer_viewer_file_name') ?? $cfg->get('viewer_file_name') ?? '')),
      trim((string) ($cfg->get('dfg_3dviewer_viewer_file_upload') ?? $cfg->get('viewer_file_upload') ?? '')),
    ]));

    foreach (['wisski_individual', 'node'] as $entity_type) {
      try {
        $entity = \Drupal::entityTypeManager()->getStorage($entity_type)->load($id);
        if (!$entity) {
          continue;
        }

        foreach ($field_candidates as $field_name) {
          $resolved = $this->resolveEntityFieldToPublicUrl($entity, $field_name);
          if ($resolved === '') {
            continue;
          }

          $record['3D_file'] = $resolved;
          \Drupal::logger('dfg_3dviewer')->notice(
            'Filled missing JSON 3D_file for entity @id from local field "@field": @value',
            [
              '@id' => (string) $id,
              '@field' => $field_name,
              '@value' => $resolved,
            ]
          );
          return $record;
        }
      }
      catch (\Throwable $e) {
        // Try the next entity type.
      }
    }

    return $record;
  }

  protected function resolveEntityFieldToPublicUrl($entity, string $field_name): string {
    if ($field_name === '' || !method_exists($entity, 'hasField') || !$entity->hasField($field_name)) {
      return '';
    }

    $values = $entity->get($field_name)->getValue();
    $first = is_array($values[0] ?? null) ? $values[0] : [];
    if (empty($first)) {
      return '';
    }

    if (!empty($first['target_id']) && ctype_digit((string) $first['target_id'])) {
      $file = \Drupal\file\Entity\File::load((int) $first['target_id']);
      if ($file) {
        return $this->fileUriToPublicUrl((string) $file->getFileUri());
      }
    }

    foreach (['value', 'uri'] as $key) {
      $candidate = trim((string) ($first[$key] ?? ''));
      if ($candidate === '') {
        continue;
      }
      if (preg_match('#^https?://#i', $candidate)) {
        return $candidate;
      }
      if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $candidate)) {
        return $this->fileUriToPublicUrl($candidate);
      }
      if (str_starts_with($candidate, '/sites/default/files/')) {
        $base = $this->preferredPublicBaseUrl();
        return $base !== '' ? rtrim($base, '/') . $candidate : $candidate;
      }
    }

    return '';
  }

  protected function fileUriToPublicUrl(string $uri): string {
    $uri = trim($uri);
    if ($uri === '') {
      return '';
    }

    if (preg_match('#^https?://#i', $uri)) {
      return $uri;
    }

    if (str_starts_with($uri, 'public://')) {
      $relative = '/sites/default/files/' . ltrim(substr($uri, strlen('public://')), '/');
      $base = $this->preferredPublicBaseUrl();
      return $base !== '' ? rtrim($base, '/') . $relative : $relative;
    }

    try {
      $generated = (string) \Drupal::service('file_url_generator')->generateAbsoluteString($uri);
      $host = (string) parse_url($generated, PHP_URL_HOST);
      $path = (string) parse_url($generated, PHP_URL_PATH);
      if ($host !== '' && (strpos($host, '_') !== false || strtolower($host) === 'default') && $path !== '') {
        $base = $this->preferredPublicBaseUrl();
        return $base !== '' ? rtrim($base, '/') . $path : $path;
      }
      return $generated;
    }
    catch (\Throwable $e) {
      return '';
    }
  }

  protected function preferredPublicBaseUrl(): string {
    $cfg = $this->config('dfg_3dviewer.settings');
    $candidates = [
      trim((string) ($cfg->get('dfg_3dviewer_main_url') ?? $cfg->get('main_url') ?? '')),
      trim((string) ($cfg->get('dfg_3dviewer_json_export_base_url') ?? $cfg->get('json_export_base_url') ?? '')),
    ];

    foreach ($candidates as $candidate) {
      $parts = parse_url($candidate);
      $host = is_array($parts) ? (string) ($parts['host'] ?? '') : '';
      if (is_array($parts) && !empty($parts['scheme']) && $host !== '' && strpos($host, '_') === false && strtolower($host) !== 'default') {
        return rtrim($candidate, '/');
      }
    }

    return '';
  }

  protected function firstNonEmptyValue(array $record, array $keys): string {
    foreach ($keys as $key) {
      $value = $this->stringValue($record, $key);
      if ($value !== '') {
        return $value;
      }
    }

    return '';
  }

  protected function stringValue(array $record, string $key, string $default = ''): string {
    if (!array_key_exists($key, $record)) {
      return $default;
    }

    $value = $record[$key];
    if (is_array($value)) {
      $value = implode(', ', array_filter(array_map('strval', $value)));
    }

    return trim((string) $value) ?: $default;
  }

  protected function guessMimeTypeFromUrl(string $url): string {
    $path = parse_url($url, PHP_URL_PATH);
    $extension = strtolower(pathinfo((string) $path, PATHINFO_EXTENSION));

    return match ($extension) {
      'glb' => 'model/gltf-binary',
      'gltf' => 'model/gltf+json',
      'fbx' => 'application/octet-stream',
      'obj' => 'text/plain',
      'stl' => 'model/stl',
      'ply' => 'application/octet-stream',
      'dae' => 'model/vnd.collada+xml',
      'jpg', 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      default => 'application/octet-stream',
    };
  }

  protected function extractModelUrlFromRecord(array $record): string {
    $candidate = $this->firstNonEmptyValue($record, [
      'converted_file',
      '3D_file',
      '3d_file_original',
      '3D_file_original',
      '3d_file',
      'model_file',
      'model',
      'file',
      'viewer_file',
      'viewer_file_name',
    ]);
    if ($this->isModelUrl($candidate)) {
      return $candidate;
    }

    foreach ($this->flattenRecordStrings($record) as $value) {
      if ($this->isModelUrl($value)) {
        return $value;
      }
    }

    return '';
  }

  protected function detectModelSourceInRecord(array $record): string {
    $ordered_keys = [
      'converted_file',
      '3D_file',
      '3d_file_original',
      '3D_file_original',
      '3d_file',
      'model_file',
      'model',
      'file',
      'viewer_file',
      'viewer_file_name',
    ];

    foreach ($ordered_keys as $key) {
      $value = $this->stringValue($record, $key);
      if ($value !== '' && $this->isModelUrl($value)) {
        return $key;
      }
    }

    return 'flattened_record_scan';
  }

  protected function flattenRecordStrings(array $record): array {
    $values = [];

    foreach ($record as $value) {
      if (is_array($value)) {
        $values = array_merge($values, $this->flattenRecordStrings($value));
        continue;
      }

      if (is_scalar($value) || (is_object($value) && method_exists($value, '__toString'))) {
        $values[] = trim((string) $value);
      }
    }

    return $values;
  }

  protected function isModelUrl(string $value): bool {
    if ($value === '' || !preg_match('#^https?://#i', $value)) {
      return false;
    }

    $path = (string) parse_url($value, PHP_URL_PATH);
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

    return in_array($extension, ['glb', 'gltf', 'fbx', 'obj', 'stl', 'ply', 'dae', '3ds', 'ifc', 'xyz', 'pcd', 'abc'], true);
  }

  protected function normalizeDefaultHostUrls(string $xml, string $domain): string {
    $domain = $this->normalizeDomain($domain);
    if ($domain === '') {
      return $xml;
    }

    $normalized = preg_replace('#https?://(default|dfg_3dviewer)(?=/)#i', $domain, $xml);
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

  protected function fetchXsl(): string {
    $response = $this->httpClient->request('GET', self::XSL_URL, ['http_errors' => false]);
    if ($response->getStatusCode() !== 200) {
      throw new \RuntimeException('Cannot fetch XSL: ' . $response->getStatusCode());
    }
    return (string) $response->getBody();
  }

  /**
   * Pretty-print XML.
   */
  protected function formatXml(string $xml): string {
    $dom = new \DOMDocument('1.0');
    $dom->preserveWhiteSpace = false;
    $dom->formatOutput = true;
    $dom->loadXML($xml);

    return $dom->saveXML();
  }

  /**
   * Save XML to files directory.
   */
  protected function saveXml(string $id, string $xml): string {
    $directory = self::FILE_DIR;
    $this->fileSystem->prepareDirectory(
      $directory,
      FileSystemInterface::CREATE_DIRECTORY | FileSystemInterface::MODIFY_PERMISSIONS
    );

    $path = $directory . '/' . $id . '.xml';
    $real_path = $this->fileSystem->realpath($directory);

    file_put_contents($real_path . '/' . $id . '.xml', $xml);

    return $path;
  }

}
