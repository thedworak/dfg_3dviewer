<?php

namespace Drupal\dfg_3dviewer\Service;

class ModelFormatManager {

  protected array $allowedModelFormats = [
    'abc', 'obj', 'fbx', 'ply', 'dae', 'ifc',
    'stl', 'xyz', 'pcd', 'json', '3ds',
    'blend', 'gml', 'wrl', 'glb', 'gltf'
  ];

  protected array $zipFormats = [
    'zip', 'rar', 'tar', 'xz', 'gz'
  ];

  public function getAllowedModelFormats(): array {
    return $this->allowedModelFormats;
  }

  public function getZipFormats(): array {
    return $this->zipFormats;
  }

  public function getAllFormats(): array {
    return array_merge($this->allowedModelFormats, $this->zipFormats);
  }
}