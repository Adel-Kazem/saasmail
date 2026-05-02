<?php
/**
 * CoMpOnEnTShort.php - Collect file content or copy files
 * Output: ./Components_content.txt OR ./z_copied_files/{timestamp}/
 * Usage: php CoMpOnEnTShort.php [--copy-files]
 */

declare(strict_types=1);

$copyFilesFlag = in_array('--copy-files', $argv, true);

$outputFile = __DIR__ . DIRECTORY_SEPARATOR . 'Components_content.txt';

// Paste file path below:
$path = '

  C:\xampp\htdocs\saasmail\wrangler.jsonc
  C:\xampp\htdocs\saasmail.dev.vars
  C:\xampp\htdocs\NovaSuite\apps\NovaStores\app\Mail\Transport\CloudflareEmailTransport.php
  C:\xampp\htdocs\NovaSuite\apps\NovaStores\config\mail.php
  C:\xampp\htdocs\NovaSuite\apps\NovaStores\config\services.php
  C:\xampp\htdocs\NovaSuite\apps\NovaStores\app\Providers\AppServiceProvider.php
  C:\xampp\htdocs\NovaSuite\apps\NovaStores.env


';

// Additional files (optional) - prefix a line with // to disable it:
$additionalFiles = '
//C:\xampp\htdocs\NovaSuite\cloudflare-worker\src\index.js
//C:\xampp\htdocs\NovaSuite\cloudflare-worker\wrangler.toml

//C:\xampp\htdocs\NovaSuite\apps\NovaStores\Z_Documentation\ProjectGuide\ProjectFullGuide.txt
//C:\xampp\htdocs\NovaSuite\apps\NovaStores\Z_Documentation\ProjectGuide\project-icons-extractor\output\NOVA-BUTTON-ICON-COMPLETE-GUIDE.txt
//C:\xampp\htdocs\NovaSuite\apps\NovaStores\resources\views\components\layout.blade.php
//C:\xampp\htdocs\NovaSuite\apps\NovaStores\resources\views\components\navigation.blade.php
//C:\xampp\htdocs\NovaSuite\apps\NovaStores\Z_Documentation\ProjectGuide\officialSpladeDataComponent.txt
//C:\xampp\htdocs\NovaSuite\apps\NovaStores\resources\views\landing-page.blade.php
//C:\xampp\htdocs\NovaSuite\apps\NovaStores\resources\views\privacy-policy-connector.blade.php
//C:\xampp\htdocs\NovaSuite\apps\NovaStores\laravel_manifest_extracted.txt
//C:\xampp\htdocs\NovaSuite\apps\NovaStores\VUE_COMPONENT_GUIDE.txt

';

if (PHP_SAPI !== 'cli') {
    http_response_code(400);
    echo "Run this script from CLI: php CoMpOnEnTShort.php\n";
    exit(1);
}

$path = trim($path);

if ($path === '' && trim($additionalFiles) === '') {
    fwrite(STDERR, "No path provided. Edit \$path in the script.\n");
    exit(1);
}

// Split by newlines to support multiple paths
$paths = preg_split('/\r?\n/', $path, -1, PREG_SPLIT_NO_EMPTY);
$extraPaths = preg_split('/\r?\n/', $additionalFiles, -1, PREG_SPLIT_NO_EMPTY);
$extraPaths = array_filter($extraPaths, fn($line) => !str_starts_with(trim($line), '//'));
$paths = array_values(array_unique(array_merge($paths, array_values($extraPaths))));
$processedFiles = [];
$successCount = 0;

if ($copyFilesFlag) {
    $baseDir = __DIR__ . DIRECTORY_SEPARATOR . 'z_copied_files';
    if (!is_dir($baseDir)) {
        if (!mkdir($baseDir, 0755, true)) {
            fwrite(STDERR, "Failed to create directory: {$baseDir}\n");
            exit(1);
        }
    }

    $timestamp = date('Y-m-d_H-i-s');
    $outputDir = $baseDir . DIRECTORY_SEPARATOR . $timestamp;
    if (!mkdir($outputDir, 0755, true)) {
        fwrite(STDERR, "Failed to create directory: {$outputDir}\n");
        exit(1);
    }

    foreach ($paths as $p) {
        $p = trim($p);
        if ($p === '') continue;

        $p = preg_replace('/^["\']|["\']$/', '', $p);

        if (!is_file($p)) {
            $processedFiles[] = "File Path: {$p}\n[ERROR] File not found.";
            continue;
        }

        if (!is_readable($p)) {
            $processedFiles[] = "File Path: {$p}\n[ERROR] File is not readable.";
            continue;
        }

        $fileName = basename($p);
        $destinationFile = $outputDir . DIRECTORY_SEPARATOR . $fileName;

        if (!copy($p, $destinationFile)) {
            $processedFiles[] = "File Path: {$p}\n[ERROR] Failed to copy file.";
            continue;
        }

        $processedFiles[] = "✓ Copied: {$fileName}";
        $successCount++;
    }

    echo "Done. " . $successCount . " file(s) copied to: {$outputDir}\n";
    foreach ($processedFiles as $msg) {
        echo $msg . "\n";
    }

} else {
    $chunks = [];

    foreach ($paths as $p) {
        $p = trim($p);
        if ($p === '') continue;

        $p = preg_replace('/^["\']|["\']$/', '', $p);

        if (!is_file($p)) {
            $chunks[] = "File Path: {$p}\n\n[ERROR] File not found.";
            continue;
        }

        if (!is_readable($p)) {
            $chunks[] = "File Path: {$p}\n\n[ERROR] File is not readable.";
            continue;
        }

        $content = file_get_contents($p);
        if ($content === false) {
            $chunks[] = "File Path: {$p}\n\n[ERROR] Failed to read file.";
            continue;
        }

        // Remove [previous exception] blocks
        $content = preg_replace('/\[previous exception\][^\[]*?\[stacktrace\]/', '[stacktrace]', $content);

        // Remove [stacktrace] blocks
        $content = preg_replace('/\[stacktrace\].*?#\d+\s+\{main\}.*?"\}/s', '', $content);

        // Remove standalone stack traces
        $content = preg_replace('/^#0\s+.*?#\d+\s+\{main\}.*?"\}/sm', '', $content);

        // Collapse all whitespace to single space
        $content = preg_replace('/\s+/', ' ', $content);
        $content = trim($content);

        $chunks[] = "File Path: {$p}\n\n" . $content;
        $successCount++;
    }

    $result = implode("\n\n\n", $chunks);

    if (file_put_contents($outputFile, $result) === false) {
        fwrite(STDERR, "Failed to write output to: {$outputFile}\n");
        exit(1);
    }

    $sizeInBytes = filesize($outputFile);
    $sizeInKB = number_format($sizeInBytes / 1024, 2);

    echo "Done. " . $successCount . " file(s) written to: {$outputFile}\n";
    echo "Overall Output Size: {$sizeInKB} KB\n";
}
