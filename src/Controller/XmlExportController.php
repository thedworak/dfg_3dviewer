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
    if ($request->isMethod('GET')) {
      $domain = $request->query->get('domain');
    }
    else {
      $data = json_decode($request->getContent(), true);
      $id = $id ?? ($data['id'] ?? null);
      $domain = $data['domain'] ?? null;
    }

    if (!$id || !$domain) {
      return new Response('Missing id or domain', 400);
    }

    try {
      $xml = $this->fetchSourceXml($request, (int) $id, $domain);
      $result = $this->transformXml($xml);
      $this->saveXml((string) $id, $result);

      return new Response(
        $result,
        200,
        ['Content-Type' => 'application/xml']
      );
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->error($e->getMessage());
      return new Response('XML export failed', 500);
    }
  }


  /**
   * Load source XML from request body or from the configured domain.
   */
  protected function fetchSourceXml(Request $request, int $id, string $domain): \SimpleXMLElement {
    $xmlString = trim($request->getContent() ?? '');
    if ($xmlString !== '') {
      libxml_use_internal_errors(true);
      $xml = simplexml_load_string($xmlString);
      if ($xml instanceof \SimpleXMLElement) {
        return $xml;
      }
    }

    return $this->fetchSourceXmlFromDomain($id, $domain);
  }

  protected function fetchSourceXmlFromDomain(int $id, string $domain): \SimpleXMLElement {
    $domain = $this->normalizeDomain($domain);
    $query = http_build_query(['page' => 0, '_format' => 'xml']);

    foreach (self::EXPORT_PATHS as $pattern) {
      $url = $domain . sprintf($pattern, $id) . '?' . $query;
      $response = $this->httpClient->request('GET', $url, ['http_errors' => false]);
      if ($response->getStatusCode() !== 200) {
        continue;
      }

      $xmlString = (string) $response->getBody();
      if ($xmlString === '') {
        continue;
      }

      libxml_use_internal_errors(true);
      $xml = simplexml_load_string($xmlString);
      if ($xml instanceof \SimpleXMLElement) {
        return $xml;
      }
    }

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

  /**
   * Transform XML using XSLT.
   */
  protected function transformXml(\SimpleXMLElement $xml): string {
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

    return $this->formatXml($result);
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
    $this->fileSystem->prepareDirectory(
      self::FILE_DIR,
      FileSystemInterface::CREATE_DIRECTORY | FileSystemInterface::MODIFY_PERMISSIONS
    );

    $path = self::FILE_DIR . '/' . $id . '.xml';
    $real_path = $this->fileSystem->realpath(self::FILE_DIR);

    file_put_contents($real_path . '/' . $id . '.xml', $xml);

    return $path;
  }

}
