<?php
/**
 * Play50Games Certificate Generator
 * Generates PDF certificates for completed games
 */

/**
 * Generate certificate PDF (or HTML if PDF library not available)
 */
function play50_generate_certificate_pdf($post_id, $certificate_data) {
    $upload_dir = wp_upload_dir();
    $certificates_dir = $upload_dir['basedir'] . '/play50-certificates';
    
    // Create directory if it doesn't exist
    if (!file_exists($certificates_dir)) {
        wp_mkdir_p($certificates_dir);
    }
    
    $certificate_id = $certificate_data['certificate_id'];
    
    // Get or generate cert_id_display
    if (empty($certificate_data['cert_id_display'])) {
        $completion_date = !empty($certificate_data['completion_date']) ? $certificate_data['completion_date'] : current_time('Y-m-d');
        $player_name = !empty($certificate_data['player_name']) ? $certificate_data['player_name'] : '';
        $year = date('Y', strtotime($completion_date));
        $hash = md5($certificate_id . $completion_date . $player_name);
        $unique_number = abs(crc32($hash)) % 100000;
        $unique_number = str_pad($unique_number, 5, '0', STR_PAD_LEFT);
        $cert_id_display = 'P50-' . $year . '-' . $unique_number;
    } else {
        $cert_id_display = $certificate_data['cert_id_display'];
    }
    
    // Create filename with firstname-lastname-cert_id_display
    $player_name = !empty($certificate_data['player_name']) ? $certificate_data['player_name'] : 'player';
    $name_parts = explode(' ', trim($player_name));
    $firstname = !empty($name_parts[0]) ? sanitize_file_name($name_parts[0]) : 'player';
    $lastname = !empty($name_parts[1]) ? sanitize_file_name($name_parts[1]) : '';
    $name_slug = $lastname ? $firstname . '-' . $lastname : $firstname;
    $name_slug = strtolower($name_slug);
    
    $filename = $name_slug . '-' . $cert_id_display . '.pdf';
    $filepath = $certificates_dir . '/' . $filename;
    $url = $upload_dir['baseurl'] . '/play50-certificates/' . $filename;
    
    // Try to generate PDF using DomPDF if available
    $pdf_result = play50_generate_certificate_pdf_with_dompdf($certificate_data);
    if ($pdf_result !== false) {
        // DomPDF is available and PDF was generated successfully
        return $pdf_result;
    }
    
    // If DomPDF is not available, fallback to HTML (should not happen if DomPDF is installed)
    // This is a fallback for cases where DomPDF installation failed
    error_log('DomPDF not available for certificate ' . $certificate_id . '. Falling back to HTML.');
    
    $html = play50_generate_certificate_html($certificate_data);
    
    // Save as HTML with PDF extension (can be opened in browser and printed to PDF)
    $html_path = str_replace('.pdf', '.html', $filepath);
    file_put_contents($html_path, $html);
    
    // Return URL (will be HTML but with .pdf extension)
    return str_replace('.html', '.pdf', $url);
}

/**
 * Generate certificate HTML
 */
function play50_generate_certificate_html($certificate_data) {

  $player_name = esc_html($certificate_data['player_name']);
  $completion_date = esc_html($certificate_data['completion_date']);
  $total_score = intval($certificate_data['total_score']);
  $rank = esc_html($certificate_data['rank']);
  $certificate_id = esc_html($certificate_data['certificate_id']);

  // Get or generate cert_id_display
  if (!empty($certificate_data['cert_id_display'])) {
      $cert_id_display = $certificate_data['cert_id_display'];
  } else {
      // Generate unique certificate display ID
      $year = date('Y', strtotime($completion_date));
      $hash = md5($certificate_id . $completion_date . $player_name);
      $unique_number = abs(crc32($hash)) % 100000;
      $unique_number = str_pad($unique_number, 5, '0', STR_PAD_LEFT);
      $cert_id_display = 'P50-' . $year . '-' . $unique_number;
  }

  // Generate PDF URL with new filename format
  $upload_dir = wp_upload_dir();
  $name_parts = explode(' ', trim($player_name));
  $firstname = !empty($name_parts[0]) ? sanitize_file_name($name_parts[0]) : 'player';
  $lastname = !empty($name_parts[1]) ? sanitize_file_name($name_parts[1]) : '';
  $name_slug = $lastname ? strtolower($firstname . '-' . $lastname) : strtolower($firstname);
  $pdf_filename = $name_slug . '-' . $cert_id_display . '.pdf';
  $pdf_url = $upload_dir['baseurl'] . '/play50-certificates/' . $pdf_filename;
  if (strpos($pdf_url, 'http') !== 0) {
      $pdf_url = get_site_url() . $pdf_url;
  }
  
  // Add certificate ID as parameter to QR code URL
  $verify_url = get_site_url() . '/verify?cert_id=' . urlencode($cert_id_display);
  $qr_code_url = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&ecc=H&data=' . urlencode($verify_url);

  // Get logo URL from Main Logo in theme options
  $theme_options_all = get_option('play50_games_theme_options_all');
  $logo_url = '';
  if (!empty($theme_options_all['play50_games_logo'])) {
      $logo_url = $theme_options_all['play50_games_logo'];
      // Ensure full URL if relative
      if (strpos($logo_url, 'http') !== 0) {
          $site_url = get_site_url();
          // If it starts with /, it's already relative to site root
          if (strpos($logo_url, '/') === 0) {
              $logo_url = $site_url . $logo_url;
          } else {
              // Otherwise, it might be relative to uploads
              $logo_url = $site_url . '/' . $logo_url;
          }
      }
  }
  
  // Use default logo if not set - try to use Next.js image path
  if (empty($logo_url)) {
      $site_url = get_site_url();
      // Try common logo paths
      $possible_logo_paths = array(
          $site_url . '/_next/image?url=%2Fimages%2Flogo%2Fplay50games.png&w=256&q=75',
          $site_url . '/images/logo/play50games.png',
          $site_url . '/wp-content/themes/play50games/images/logo/play50games.png'
      );
      // Use the first path that might work (Next.js path from user's template)
      $logo_url = $possible_logo_paths[0];
  }

  // cert_id_display is already generated above, just format the date
  $issued_date = date('d M Y', strtotime($completion_date));

  $score_percentage = min(100, round(($total_score / 500) * 100));
  $games_played = 5;
  
  // Escape logo URL for use in HTML
  $logo_url_escaped = !empty($logo_url) ? esc_url($logo_url) : '';
  $logo_html = !empty($logo_url_escaped) ? '<div class="logo-container"><img class="logo" src="' . $logo_url_escaped . '" alt="Play50Games Logo" /></div>' : '';

  return <<<HTML
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {
  size: A4 landscape;
  margin: 0;
}

body {
  margin: 0;
  padding: 0;
  background: #0b1020;
  font-family: Arial, sans-serif;
  color: #ffffff;
}

.sheet {
  width: 100%;
  box-sizing: border-box;
}

.pad {
  padding: 28px 36px;
  box-sizing: border-box;
}

.header {
  display: table;
  width: 100%;
}

.header-left,
.header-right {
  display: table-cell;
  vertical-align: middle;
}

.header-left {
  display: table;
}

.logo-container {
  display: table-cell;
  vertical-align: middle;
  padding-right: 12px;
}

.logo {
  width: 56px;
  height: auto;
}

.brand-text {
  display: table-cell;
  vertical-align: middle;
}

.header-right {
  text-align: right;
  font-size: 12px;
  opacity: 0.8;
}

 .title {
   margin-top: 100px;
   text-align: center;
   font-size: 40px;
   color: #eab308;
 }

.subtitle {
  margin-top: 10px;
  text-align: center;
  font-size: 14px;
  opacity: 0.75;
}

.name {
  margin-top: 40px;
  text-align: center;
  font-size: 34px;
  font-weight: bold;
  color: #eab308;
}

.line {
  width: 420px;
  height: 2px;
  background: #eab308;
  margin: 14px auto 0;
}

.details {
  margin-top: 30px;
  display: table;
  width: 100%;
}

.detail {
  display: table-cell;
  padding: 12px;
}

.box {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  padding: 14px;
  border-radius: 10px;
  text-align: center;
}

.box small {
  display: block;
  font-size: 11px;
  opacity: 0.7;
}

.box strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  color: #eab308;
}

.bottom {
  margin-top: 70px;
  display: table;
  width: 100%;
  font-size: 11px;
  opacity: 0.8;
}

.qr {
  display: table-cell;
  width: 160px;
  vertical-align: middle;
}

.qr img {
  width: 140px;
  height: 140px;
  background: #fff;
  padding: 10px;
  display: block;
}

.qr-text {
  margin-top: 8px;
  font-size: 11px;
  text-align: center;
}

.bottom-text {
  display: table-cell;
  text-align: right;
  vertical-align: bottom;
}
</style>
</head>

<body>
<div class="sheet">
<div class="pad">

<div class="header">
  <div class="header-left">
      {$logo_html}
      <div class="brand-text">
          <strong>Play50Games</strong><br>
          <small>Skill & Focus Training</small>
      </div>
  </div>
  <div class="header-right">
      Certificate ID: <strong>{$cert_id_display}</strong><br>
      Issued: <strong>{$issued_date}</strong>
  </div>
</div>

<div class="title">Certificate of Achievement</div>
<div class="subtitle">
Presented in recognition of exceptional performance and cognitive skills.
</div>

<div class="name">{$player_name}</div>
<div class="line"></div>

<div class="details">
  <div class="detail">
      <div class="box">
          <small>Rank</small>
          <strong>{$rank}</strong>
      </div>
  </div>
  <div class="detail">
      <div class="box">
          <small>Games Played</small>
          <strong>{$games_played}</strong>
      </div>
  </div>
  <div class="detail">
      <div class="box">
          <small>Score</small>
          <strong>{$score_percentage}%</strong>
      </div>
  </div>
</div>

 <div class="bottom">
   <div class="qr">
       <img src="{$qr_code_url}">
       <div class="qr-text">
           Scan to verify<br>
           play50.games/verify
       </div>
   </div>
   <div class="bottom-text">
       Issued by Play50Games<br>
       Digital Certificate – Verify Online
   </div>
 </div>

</div>
</div>
</body>
</html>
HTML;
}

/**
 * Generate PDF using DomPDF (if available)
 * Requires: composer require dompdf/dompdf
 */
function play50_generate_certificate_pdf_with_dompdf($certificate_data) {
    // Try to load via Composer autoload first
    $composer_autoload = get_stylesheet_directory() . '/vendor/autoload.php';
    if (file_exists($composer_autoload)) {
        require_once $composer_autoload;
    }
    
    // Check if DomPDF is available
    if (!class_exists('Dompdf\Dompdf')) {
        return false; // DomPDF not available
    }
    
    try {
        $html = play50_generate_certificate_html($certificate_data);
        
        $dompdf = new \Dompdf\Dompdf();
        
        // Set options for better PDF quality
        $options = $dompdf->getOptions();
        $options->set('isRemoteEnabled', true); // Allow remote images (for logo, QR code)
        $options->set('isHtml5ParserEnabled', true);
        $options->set('enableCssFloat', false);
        $dompdf->setOptions($options);
        
        $dompdf->loadHtml($html);
        // Set paper size explicitly in points (A4 landscape: 842 x 595 points = 297mm x 210mm)
        $dompdf->setPaper(array(0, 0, 842, 595), 'landscape');
        $dompdf->render();
        
        $upload_dir = wp_upload_dir();
        $certificates_dir = $upload_dir['basedir'] . '/play50-certificates';
        
        if (!file_exists($certificates_dir)) {
            wp_mkdir_p($certificates_dir);
        }
        
        $certificate_id = $certificate_data['certificate_id'];
        
        // Get or generate cert_id_display
        if (empty($certificate_data['cert_id_display'])) {
            $completion_date = !empty($certificate_data['completion_date']) ? $certificate_data['completion_date'] : current_time('Y-m-d');
            $player_name = !empty($certificate_data['player_name']) ? $certificate_data['player_name'] : '';
            $year = date('Y', strtotime($completion_date));
            $hash = md5($certificate_id . $completion_date . $player_name);
            $unique_number = abs(crc32($hash)) % 100000;
            $unique_number = str_pad($unique_number, 5, '0', STR_PAD_LEFT);
            $cert_id_display = 'P50-' . $year . '-' . $unique_number;
        } else {
            $cert_id_display = $certificate_data['cert_id_display'];
        }
        
        // Create filename with firstname-lastname-cert_id_display
        $player_name = !empty($certificate_data['player_name']) ? $certificate_data['player_name'] : 'player';
        $name_parts = explode(' ', trim($player_name));
        $firstname = !empty($name_parts[0]) ? sanitize_file_name($name_parts[0]) : 'player';
        $lastname = !empty($name_parts[1]) ? sanitize_file_name($name_parts[1]) : '';
        $name_slug = $lastname ? strtolower($firstname . '-' . $lastname) : strtolower($firstname);
        
        $filename = $name_slug . '-' . $cert_id_display . '.pdf';
        $filepath = $certificates_dir . '/' . $filename;
        
        // Save PDF file
        file_put_contents($filepath, $dompdf->output());
        
        return $upload_dir['baseurl'] . '/play50-certificates/' . $filename;
        
    } catch (Exception $e) {
        // Log error and return false to fallback to HTML
        error_log('DomPDF Error: ' . $e->getMessage());
        return false;
    }
}

