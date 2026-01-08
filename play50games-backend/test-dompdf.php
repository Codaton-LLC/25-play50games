<?php
/**
 * Test file për të verifikuar instalimin e DomPDF
 * 
 * Ky file duhet të jetë në WordPress root directory
 * URL: https://cms.play50.games/test-dompdf.php
 * 
 * FSHI këtë file pas testimit për siguri!
 */

// Load WordPress
require_once(__DIR__ . '/wp-load.php');

echo "<!DOCTYPE html>";
echo "<html><head><meta charset='UTF-8'><title>DomPDF Test</title>";
echo "<style>body{font-family:Arial,sans-serif;max-width:800px;margin:20px auto;padding:20px;}h1{color:#333;}h2{color:#666;margin-top:20px;}code{background:#f4f4f4;padding:2px 6px;border-radius:3px;}</style>";
echo "</head><body>";

echo "<h1>DomPDF Installation Test</h1>";
echo "<hr>";

// Get theme directory
$theme_dir = get_stylesheet_directory();
$autoload_path = $theme_dir . '/vendor/autoload.php';

// Test 1: Check if Composer autoload exists
echo "<h2>Test 1: Composer Autoload</h2>";
echo "<p><strong>Theme Directory:</strong> <code>" . esc_html($theme_dir) . "</code></p>";
echo "<p><strong>Autoload Path:</strong> <code>" . esc_html($autoload_path) . "</code></p>";

if (file_exists($autoload_path)) {
    echo "<p>✅ <strong>PASS:</strong> vendor/autoload.php ekziston</p>";
    require_once $autoload_path;
    echo "<p>✅ <strong>PASS:</strong> Autoloader u ngarkua me sukses</p>";
} else {
    echo "<p>❌ <strong>FAIL:</strong> vendor/autoload.php nuk ekziston</p>";
    echo "<p>📍 Path i kontrolluar: <code>" . esc_html($autoload_path) . "</code></p>";
    echo "<p>⚠️ <strong>Zgjidhje:</strong> Instalo Composer dependencies:</p>";
    echo "<p><code>cd " . esc_html($theme_dir) . " && composer install</code></p>";
    echo "</body></html>";
    die();
}
echo "<br>";

// Test 2: Check if DomPDF class exists
echo "<h2>Test 2: DomPDF Class</h2>";
if (class_exists('Dompdf\Dompdf')) {
    echo "<p>✅ <strong>PASS:</strong> DomPDF class ekziston</p>";
} else {
    echo "<p>❌ <strong>FAIL:</strong> DomPDF class nuk ekziston</p>";
    echo "<p>⚠️ <strong>Zgjidhje:</strong> Instalo DomPDF:</p>";
    echo "<p><code>cd " . esc_html($theme_dir) . " && composer require dompdf/dompdf</code></p>";
    echo "</body></html>";
    die();
}
echo "<br>";

// Test 3: Check DomPDF version
echo "<h2>Test 3: DomPDF Version</h2>";
try {
    $dompdf = new \Dompdf\Dompdf();
    $version = defined('Dompdf\Dompdf::VERSION') ? \Dompdf\Dompdf::VERSION : 'Unknown';
    echo "<p>✅ <strong>PASS:</strong> DomPDF version: <strong>" . esc_html($version) . "</strong></p>";
} catch (Exception $e) {
    echo "<p>❌ <strong>FAIL:</strong> Nuk mund të krijohet DomPDF instance</p>";
    echo "<p>Error: <code>" . esc_html($e->getMessage()) . "</code></p>";
    echo "</body></html>";
    die();
}
echo "<br>";

// Test 4: Check required PHP extensions
echo "<h2>Test 4: PHP Extensions</h2>";
$required_extensions = ['mbstring', 'gd', 'dom', 'xml'];
$all_ok = true;

foreach ($required_extensions as $ext) {
    if (extension_loaded($ext)) {
        echo "<p>✅ <strong>PASS:</strong> $ext extension është i instaluar</p>";
    } else {
        echo "<p>❌ <strong>FAIL:</strong> $ext extension nuk është i instaluar</p>";
        $all_ok = false;
    }
}

if (!$all_ok) {
    echo "<p>⚠️ <strong>Zgjidhje:</strong> Aktivizo extensions në php.ini ose cPanel</p>";
}
echo "<br>";

// Test 5: Try to generate a simple PDF
echo "<h2>Test 5: PDF Generation Test</h2>";
try {
    $dompdf = new \Dompdf\Dompdf();
    $html = '<html><body><h1>Test PDF</h1><p>Ky është një test PDF.</p></body></html>';
    $dompdf->loadHtml($html);
    $dompdf->setPaper('A4', 'portrait');
    $dompdf->render();
    
    $output = $dompdf->output();
    if (!empty($output)) {
        echo "<p>✅ <strong>PASS:</strong> PDF u gjenerua me sukses!</p>";
        echo "<p>📄 PDF size: <strong>" . number_format(strlen($output)) . " bytes</strong></p>";
    } else {
        echo "<p>❌ <strong>FAIL:</strong> PDF output është bosh</p>";
    }
} catch (Exception $e) {
    echo "<p>❌ <strong>FAIL:</strong> Gabim në gjenerimin e PDF</p>";
    echo "<p>Error: <code>" . esc_html($e->getMessage()) . "</code></p>";
}
echo "<br>";

// Test 6: Check file permissions
echo "<h2>Test 6: File Permissions</h2>";
$vendor_dir = $theme_dir . '/vendor';
if (is_readable($vendor_dir)) {
    echo "<p>✅ <strong>PASS:</strong> vendor/ directory është readable</p>";
} else {
    echo "<p>❌ <strong>FAIL:</strong> vendor/ directory nuk është readable</p>";
    echo "<p>⚠️ <strong>Zgjidhje:</strong> Ndrysho permissions:</p>";
    echo "<p><code>chmod -R 755 " . esc_html($vendor_dir) . "</code></p>";
}
echo "<br>";

// Final result
echo "<hr>";
echo "<h2>📊 Rezultati Final</h2>";

$all_tests_passed = file_exists($autoload_path) && 
                    class_exists('Dompdf\Dompdf') && 
                    $all_ok;

if ($all_tests_passed) {
    echo "<div style='background: #d4edda; border: 2px solid #28a745; padding: 20px; border-radius: 5px;'>";
    echo "<h3 style='color: #155724; margin: 0;'>✅ DomPDF është instaluar me sukses!</h3>";
    echo "<p style='color: #155724; margin: 10px 0 0 0;'>Certifikatat do të gjenerohen si PDF të vërteta.</p>";
    echo "</div>";
} else {
    echo "<div style='background: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 5px;'>";
    echo "<h3 style='color: #721c24; margin: 0;'>❌ DomPDF nuk është instaluar plotësisht</h3>";
    echo "<p style='color: #721c24; margin: 10px 0 0 0;'>Shiko testet e mësipërme për detaje.</p>";
    echo "</div>";
}

echo "<br>";
echo "<p><strong>⚠️ IMPORTANT:</strong> Fshi këtë file pas testimit për siguri!</p>";
echo "<p><code>rm test-dompdf.php</code> ose fshi përmes FTP/File Manager</p>";
echo "</body></html>";
?>
