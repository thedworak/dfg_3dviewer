<?php

namespace Drupal\dfg_3dviewer\Service;

use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;

class ConvertProcessService {

  protected $logger;

  public function __construct(LoggerChannelFactoryInterface $logger_factory) {
    $this->logger = $logger_factory->get('dfg_3dviewer');
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
        array $options = []
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
            '-t', $lightweight,
            '-c', $options['c'] ?? 'true',
            '-l', $options['l'] ?? '3',
            '-b', $options['b'] ?? 'true',
            '-i', $inputPath,
        ];

        // opcjonalne parametry
        if (!empty($options['o'])) {
            $args[] = '-o';
            $args[] = $options['o'];
        }

        $args[] = '-f';
        $args[] = $options['f'] ?? 'true';

        if (isset($options['a'])) {
            $args[] = '-a';
            $args[] = $options['a'];
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
        ];
    }



}
