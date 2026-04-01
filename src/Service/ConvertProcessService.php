<?php

namespace Drupal\dfg_3dviewer\Service;

use Symfony\Component\Process\Process;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;

class ConvertProcessService {

    protected $logger;

    public function __construct(LoggerChannelFactoryInterface $logger_factory) {
        $this->logger = $logger_factory->get('dfg_3dviewer');
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
            $outputName = basename($outputBase);
            $outputName = str_replace(['_ZIP', '_RAR', '_TAR', '_XZ', '_GZ'], '', $outputName);
            return $outputBase . '/gltf/' . $outputName . '.' . $outputExt;
        }

        if ($inputExt === 'glb' && $outputExt === 'glb') {
            return $inputPath;
        }

        $dirname = $this->normalizePath((string) pathinfo($inputPath, PATHINFO_DIRNAME));
        $filename = (string) pathinfo($inputPath, PATHINFO_FILENAME);
        return $dirname . '/gltf/' . $filename . '.' . $outputExt;
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
