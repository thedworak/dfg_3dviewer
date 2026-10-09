<?php

namespace Drupal\dfg_3dviewer\Service;

use Symfony\Component\Process\Process;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Config\ConfigFactoryInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;

class ConvertProcessService {

    protected $logger;
    protected $configFactory;
    protected $httpClient;

    public function __construct(
        LoggerChannelFactoryInterface $logger_factory,
        ConfigFactoryInterface $config_factory,
        ClientInterface $http_client
    ) {
        $this->logger = $logger_factory->get('dfg_3dviewer');
        $this->configFactory = $config_factory;
        $this->httpClient = $http_client;
    }

    /**
     * Reads the conversion backend ("local" or "docker") and, for "docker",
     * the base URL of the standalone worker container (see worker/README.md).
     * Defaults to "local" so existing installs that never set these config
     * keys keep running scripts/convert.sh & render.sh directly, exactly as
     * before this option was introduced.
     */
    public function getBackendConfig(): array {
        $config = $this->configFactory->get('dfg_3dviewer.settings');

        $backend = strtolower(trim((string) (
            $config->get('dfg_3dviewer_conversion_backend')
            ?? $config->get('conversion_backend')
            ?? 'local'
        )));

        $worker_url = rtrim(trim((string) (
            $config->get('dfg_3dviewer_worker_url')
            ?? $config->get('worker_url')
            ?? ''
        )), '/');

        return ['backend' => $backend, 'worker_url' => $worker_url];
    }

    private function boolToString($value): string {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    private function normalizePath(string $path): string {
        return rtrim(str_replace('\\', '/', $path), '/');
    }

    private function resolveConvertedOutputPath(string $inputPath, array $options): string {
        $isBinary = filter_var($options['b'] ?? true, FILTER_VALIDATE_BOOLEAN);
        $outputExt = $isBinary ? 'glb' : 'gltf';
        $inputExt = strtolower((string) pathinfo($inputPath, PATHINFO_EXTENSION));

        if (!empty($options['o'])) {
            $outputBase = $this->normalizePath((string) $options['o']);
            $inputBase = (string) pathinfo($inputPath, PATHINFO_FILENAME);
            return $outputBase . '/gltf/' . $inputBase . '.' . $outputExt;
        }

        if ($inputExt === 'glb' && $outputExt === 'glb') {
            return $inputPath;
        }

        $dirname = $this->normalizePath((string) pathinfo($inputPath, PATHINFO_DIRNAME));
        $filename = (string) pathinfo($inputPath, PATHINFO_FILENAME);
        return $dirname . '/gltf/' . $filename . '.' . $outputExt;
    }

    private function resolveThumbnailBasePath(string $inputPath): string {
        $dirname = $this->normalizePath((string) pathinfo($inputPath, PATHINFO_DIRNAME));
        $filename = (string) pathinfo($inputPath, PATHINFO_FILENAME);
        $extension = strtolower((string) pathinfo($inputPath, PATHINFO_EXTENSION));

        return $dirname . '/views/' . $filename . '.' . $extension;
    }

    private function thumbnailsAlreadyExist(string $inputPath): bool {
        $basePath = $this->resolveThumbnailBasePath($inputPath);
        $requiredFiles = [
            $basePath . '_side45.png',
            $basePath . '_side90.png',
            $basePath . '_side135.png',
            $basePath . '_side180.png',
            $basePath . '_side225.png',
            $basePath . '_side270.png',
            $basePath . '_side315.png',
            $basePath . '_top.png',
        ];

        foreach ($requiredFiles as $file) {
            if (!file_exists($file)) {
                return FALSE;
            }
        }

        if (file_exists($basePath . '_side0.png') || file_exists($basePath . '_RENDER.png')) {
            return TRUE;
        }

        return FALSE;
    }

    private function emitProgress(?callable $onProgress, int $percent, string $state, string $message): void {
        if ($onProgress === NULL) {
            return;
        }

        try {
            $onProgress($percent, $state, $message);
        }
        catch (\Throwable $e) {
            $this->logger->warning(
                'Progress callback failed at @percent% (@state): @message',
                [
                    '@percent' => $percent,
                    '@state' => $state,
                    '@message' => $e->getMessage(),
                ]
            );
        }
    }

    /**
     * Run convert.sh process.
     *
     * @param string $spath
     * @param string $inputPath
     * @param int $lightweight
     * @param array $options
     *
     * @return array
     */
    public function run(
        string $spath,
        string $inputPath,
        int $lightweight = 0,
        array $options = [],
        ?callable $onProgress = NULL
        ) : array {

        $backend_config = $this->getBackendConfig();
        if ($backend_config['backend'] === 'docker') {
            if ($backend_config['worker_url'] === '') {
                $this->logger->error('Conversion backend is set to "docker" but no worker URL is configured; falling back to local scripts.');
            }
            else {
                return $this->runViaWorker($backend_config['worker_url'], $inputPath, $lightweight, $options, $onProgress);
            }
        }

        $script = $spath . '/scripts/convert.sh';

        if (!file_exists($script)) {
            return [
            'success' => FALSE,
            'exit_code' => NULL,
            'output' => '',
            'error' => 'Script not found',
            ];
        }

        $args = [
            $script,
            '-t', $this->boolToString($lightweight),
            '-c', $this->boolToString($options['c'] ?? true),
            '-l', $options['l'] ?? '3',
            '-b', $this->boolToString($options['b'] ?? true),
            '-i', $inputPath,
        ];

        // optional
        if (!empty($options['o'])) {
            $args[] = '-o';
            $args[] = $options['o'];
        }

        $args[] = '-f';
        $args[] = $this->boolToString($options['f'] ?? true);

        if (isset($options['a'])) {
            $args[] = '-a';
            $args[] = $options['a'];
        }

        $process = new \Symfony\Component\Process\Process($args);
        $process->setTimeout($options['timeout'] ?? 600);
        $process->setWorkingDirectory($spath);

        $this->emitProgress($onProgress, 35, 'processing', 'Converting to GLTF...');
        $process->run();

        $success = $process->isSuccessful();
        $exitCode = $process->getExitCode();
        $output = $process->getOutput();
        $error = $process->getErrorOutput();
        $renderResult = NULL;

        if ($success) {
            $this->emitProgress($onProgress, 55, 'converted', 'GLTF conversion finished.');
        }

        if ($success && !filter_var($lightweight, FILTER_VALIDATE_BOOLEAN)) {
            if ($this->thumbnailsAlreadyExist($inputPath)) {
                $this->emitProgress($onProgress, 75, 'rendering', 'Skipping thumbnail generation, files already exist.');
            }
            else {
                $this->emitProgress($onProgress, 65, 'rendering', 'Generating thumbnails...');
                $renderResult = $this->render(
                    $spath,
                    $inputPath,
                    [
                        'a' => $this->boolToString($options['a'] ?? false),
                        'g' => $this->resolveConvertedOutputPath($inputPath, $options),
                        'timeout' => $options['render_timeout'] ?? $options['timeout'] ?? 600,
                    ]
                );

                $output .= $renderResult['output'] ?? '';
                $error .= $renderResult['error'] ?? '';

                if (!($renderResult['success'] ?? FALSE)) {
                    $success = FALSE;
                    $exitCode = $renderResult['exit_code'] ?? 1;
                }
                else {
                    $this->emitProgress($onProgress, 75, 'rendering', 'Thumbnails generated.');
                }
            }
        }

        return [
            'success' => $success,
            'exit_code' => $exitCode,
            'output' => $output,
            'error' => $error,
            'command' => $process->getCommandLine(),
            'render' => $renderResult,
        ];
    }

    /**
     * Runs the conversion + thumbnail rendering pipeline through the
     * standalone worker container's HTTP API (see worker/README.md) instead
     * of local Symfony Process calls. Uploads $inputPath, polls job status
     * until it reaches "ready"/"failed", then downloads the resulting model
     * and thumbnails to the exact paths the local (non-docker) path would
     * have produced, so the rest of the Drupal pipeline (ConvertWorker.php)
     * finds them without any changes.
     */
    private function runViaWorker(
        string $workerUrl,
        string $inputPath,
        int $lightweight,
        array $options,
        ?callable $onProgress
    ): array {
        $isLightweight = filter_var($lightweight, FILTER_VALIDATE_BOOLEAN);
        $timeoutBudget = (int) ($options['timeout'] ?? 600) + (int) ($options['render_timeout'] ?? $options['timeout'] ?? 600);

        try {
            $this->emitProgress($onProgress, 10, 'preparing', 'Uploading to conversion worker...');

            $create_response = $this->httpClient->request('POST', $workerUrl . '/api/model/create', [
                'multipart' => [
                    [
                        'name' => 'file',
                        'contents' => fopen($inputPath, 'r'),
                        'filename' => pathinfo($inputPath, PATHINFO_BASENAME),
                    ],
                ],
                'timeout' => $options['upload_timeout'] ?? 120,
            ]);

            $create_body = json_decode((string) $create_response->getBody(), TRUE);
            $job_id = trim((string) ($create_body['entity_id'] ?? ''));

            if ($job_id === '') {
                return [
                    'success' => FALSE,
                    'exit_code' => 1,
                    'output' => '',
                    'error' => 'Worker did not return a job id.',
                    'command' => 'worker:' . $workerUrl . '/api/model/create',
                    'render' => NULL,
                ];
            }

            $status_url = $workerUrl . '/api/model/status/' . rawurlencode($job_id);
            $deadline = microtime(TRUE) + max($timeoutBudget, 60);
            $last_status = [];

            while (TRUE) {
                $status_response = $this->httpClient->request('GET', $status_url, [
                    'timeout' => 30,
                ]);
                $last_status = json_decode((string) $status_response->getBody(), TRUE) ?: [];

                $percent = (int) ($last_status['progress'] ?? 0);
                $state = (string) ($last_status['status'] ?? 'processing');
                $message = (string) ($last_status['message'] ?? '');
                $this->emitProgress($onProgress, $percent, $state, $message !== '' ? $message : 'Converting via worker...');

                if ($state === 'ready' || $state === 'failed') {
                    break;
                }

                if (microtime(TRUE) >= $deadline) {
                    return [
                        'success' => FALSE,
                        'exit_code' => 1,
                        'output' => '',
                        'error' => 'Worker job timed out after ' . $timeoutBudget . ' seconds.',
                        'command' => 'worker:' . $status_url,
                        'render' => NULL,
                    ];
                }

                usleep(1500000);
            }

            if ((string) ($last_status['status'] ?? '') !== 'ready') {
                return [
                    'success' => FALSE,
                    'exit_code' => 1,
                    'output' => '',
                    'error' => (string) ($last_status['message'] ?? 'Worker reported failure.'),
                    'command' => 'worker:' . $status_url,
                    'render' => NULL,
                ];
            }

            $model_url = (string) ($last_status['modelUrl'] ?? '');
            if ($model_url === '') {
                return [
                    'success' => FALSE,
                    'exit_code' => 1,
                    'output' => '',
                    'error' => 'Worker reported success but returned no model URL.',
                    'command' => 'worker:' . $status_url,
                    'render' => NULL,
                ];
            }

            $output_path = $this->resolveConvertedOutputPath($inputPath, $options);
            $this->downloadWorkerFile($workerUrl . $model_url, $output_path);

            if (!$isLightweight) {
                // When $options['o'] is set (the archive-passthrough case -
                // see ConvertWorker.php), $inputPath is the raw archive file
                // itself, not the model inside it, so its own dirname isn't
                // where render.sh would have written thumbnails; use the
                // caller-provided output base instead, mirroring
                // resolveConvertedOutputPath()'s handling of the same option.
                $thumbnails_dir = !empty($options['o'])
                    ? $this->normalizePath((string) $options['o']) . '/views'
                    : dirname($this->resolveThumbnailBasePath($inputPath));
                foreach ((array) ($last_status['imageUrls'] ?? []) as $image_url) {
                    $image_url = (string) $image_url;
                    if ($image_url === '') {
                        continue;
                    }
                    $target = rtrim($thumbnails_dir, '/\\') . '/' . basename($image_url);
                    $this->downloadWorkerFile($workerUrl . $image_url, $target);
                }
            }

            return [
                'success' => TRUE,
                'exit_code' => 0,
                'output' => 'Converted via worker job ' . $job_id . '.',
                'error' => '',
                'command' => 'worker:' . $workerUrl,
                'render' => NULL,
            ];
        }
        catch (GuzzleException $e) {
            $this->logger->error('Worker conversion request failed: @msg', ['@msg' => $e->getMessage()]);
            return [
                'success' => FALSE,
                'exit_code' => 1,
                'output' => '',
                'error' => 'Worker request failed: ' . $e->getMessage(),
                'command' => 'worker:' . $workerUrl,
                'render' => NULL,
            ];
        }
    }

    private function downloadWorkerFile(string $url, string $destination): void {
        $dir = dirname($destination);
        if (!is_dir($dir) && !mkdir($dir, 0775, TRUE) && !is_dir($dir)) {
            throw new \RuntimeException('Cannot create directory for downloaded worker file: ' . $dir);
        }

        $response = $this->httpClient->request('GET', $url, ['timeout' => 120]);
        file_put_contents($destination, (string) $response->getBody());
    }

    /**
     * Run render.sh process.
     *
     * @param string $spath
     * @param string $inputPath
     * @param array $options
     *
     * @return array
     */
    public function render(
        string $spath,
        string $inputPath,
        array $options = []
    ) : array {
        $script = $spath . '/scripts/render.sh';

        if (!file_exists($script)) {
            return [
                'success' => FALSE,
                'exit_code' => NULL,
                'output' => '',
                'error' => 'Script not found',
            ];
        }

        $args = [
            $script,
            '-i', $inputPath,
            '-a', $this->boolToString($options['a'] ?? false),
        ];

        if (!empty($options['g'])) {
            $args[] = '-g';
            $args[] = $options['g'];
        }

        $process = new \Symfony\Component\Process\Process($args);
        $process->setTimeout($options['timeout'] ?? 600);
        $process->setWorkingDirectory($spath);
        $process->run();

        return [
            'success' => $process->isSuccessful(),
            'exit_code' => $process->getExitCode(),
            'output' => $process->getOutput(),
            'error' => $process->getErrorOutput(),
            'command' => $process->getCommandLine(),
        ];
    }

    public function uncompress(
        string $spath,
        string $type,
        string $inputPath,
        string $outputPath,
        string $name,
        array $options = []
        ) : array {

        $script = $spath . '/scripts/uncompress.sh';

        if (!file_exists($script)) {
            return [
            'success' => FALSE,
            'exit_code' => NULL,
            'output' => '',
            'error' => 'Script not found',
            ];
        }

        $args = [
            $script,
            '-t', $type,
            '-i', $inputPath,
            '-o', $outputPath,
            '-n', $name,
        ];

        $process = new \Symfony\Component\Process\Process($args);
        $process->setTimeout($options['timeout'] ?? 600);
        $process->setWorkingDirectory($spath);

        $process->run();

        return [
            'success' => $process->isSuccessful(),
            'exit_code' => $process->getExitCode(),
            'output' => $process->getOutput(),
            'error' => $process->getErrorOutput(),
            'command' => $process->getCommandLine(),
        ];
    }



}
