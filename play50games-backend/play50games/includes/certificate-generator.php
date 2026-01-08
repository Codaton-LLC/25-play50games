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
    $filename = 'certificate-' . $certificate_id . '.pdf';
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
    
    // Get PDF URL for QR code
    $upload_dir = wp_upload_dir();
    $pdf_url = $upload_dir['baseurl'] . '/play50-certificates/certificate-' . $certificate_id . '.pdf';
    // Use full URL if baseurl is relative
    if (strpos($pdf_url, 'http') !== 0) {
        $site_url = get_site_url();
        $pdf_url = $site_url . $pdf_url;
    }
    
    // Generate QR code URL (using external API)
    $qr_code_url = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' . urlencode($pdf_url);
    
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
    
    // Format certificate ID for display
    $cert_id_display = 'P50-' . date('Y', strtotime($completion_date)) . '-' . substr($certificate_id, 0, 8);
    
    $html = '<!doctype html>
<html lang="sq">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Play50Games – Certificate</title>
  <style>
    /* A4 landscape print setup */
    @page { size: A4 landscape; margin: 14mm; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif;
      color: #0b1220;
      background: #0b1020;
    }
    .sheet {
      width: 297mm;
      height: 210mm;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 14mm;
      box-sizing: border-box;
    }
    .card {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.05);
      overflow: hidden;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(234, 179, 8, 0.2);
    }

    /* Decorative background - Yellow/Gold gradients for final games */
    .bg {
      position: absolute; inset: 0;
      background:
        radial-gradient(1200px 600px at 10% 20%, rgba(234, 179, 8, 0.20), transparent 55%),
        radial-gradient(1100px 650px at 95% 15%, rgba(234, 179, 8, 0.18), transparent 55%),
        radial-gradient(1000px 700px at 85% 90%, rgba(234, 179, 8, 0.14), transparent 60%),
        linear-gradient(90deg, rgba(234, 179, 8, 0.04), transparent 40%),
        #0b1020;
      pointer-events: none;
    }
    .grid {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(234, 179, 8, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(234, 179, 8, 0.05) 1px, transparent 1px);
      background-size: 22px 22px;
      opacity: 0.30;
      mask-image: radial-gradient(closest-side, rgba(0,0,0,0.95), rgba(0,0,0,0.35), transparent);
      -webkit-mask-image: radial-gradient(closest-side, rgba(0,0,0,0.95), rgba(0,0,0,0.35), transparent);
      pointer-events: none;
    }

    .content {
      position: relative;
      height: 100%;
      padding: 15mm 20mm;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 10mm;
    }

    /* Header */
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10mm;
    }
    .brand {
      display: flex; align-items: center; gap: 10px;
    }
    .logo {
      width: 42px; height: 42px;
      border-radius: 14px;
      background: linear-gradient(135deg, #111827, #334155);
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10);
      overflow: hidden;
    }
    .logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 4px;
    }
    .brand h1 {
      margin: 0;
      font-size: 16px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.95);
    }
    .brand p {
      margin: 2px 0 0;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.70);
    }

    .meta {
      text-align: right;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.70);
      line-height: 1.35;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(234, 179, 8, 0.15);
      border: 1px solid rgba(234, 179, 8, 0.3);
      font-weight: 600;
      color: rgba(255, 255, 255, 0.90);
    }
    .dot {
      width: 8px; height: 8px;
      border-radius: 99px;
      background: #eab308;
      box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.25);
    }
    .meta strong {
      color: #eab308;
    }

    /* Main */
    .main {
      display: grid;
      place-items: center;
      text-align: center;
      padding: 4mm 8mm;
    }
    .title {
      margin: 0;
      font-size: 48px;
      letter-spacing: 0.4px;
      line-height: 1.05;
      color: rgba(255, 255, 255, 0.95);
    }
    .subtitle {
      margin: 10px 0 0;
      font-size: 15px;
      color: rgba(255, 255, 255, 0.75);
      max-width: 200mm;
      line-height: 1.5;
    }

    .name {
      margin: 12mm 0 2mm;
      font-size: 40px;
      font-weight: 800;
      letter-spacing: 0.2px;
      color: #eab308;
    }
    .underline {
      width: 180mm;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(234, 179, 8, 0.50), transparent);
      border-radius: 2px;
      margin: 4mm auto 0;
    }

    .details {
      margin-top: 8mm;
      width: 220mm;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
    .detail {
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(234, 179, 8, 0.10);
      border: 1px solid rgba(234, 179, 8, 0.25);
      text-align: left;
    }
    .detail .k {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.70);
      letter-spacing: 0.4px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .detail .v {
      font-size: 14px;
      font-weight: 700;
      color: #eab308;
    }

    /* Footer */
    .footer {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      gap: 15mm;
    }
    .sign {
      display: grid;
      gap: 8px;
    }
    .line {
      height: 1px;
      background: rgba(255, 255, 255, 0.30);
      width: 80mm;
    }
    .sign .label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.70);
    }
    .seal {
      width: 64px; height: 64px;
      border-radius: 999px;
      background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(255,255,255,0.2)),
                  linear-gradient(135deg, #eab308, rgba(234, 179, 8, 0.8));
      display: grid;
      place-items: center;
      border: 1px solid rgba(234, 179, 8, 0.4);
      box-shadow: 0 12px 26px rgba(234, 179, 8, 0.25);
      position: relative;
    }
    .seal:before {
      content: "";
      position: absolute; inset: 8px;
      border-radius: 999px;
      border: 1px dashed rgba(255,255,255,0.55);
      opacity: 0.9;
    }
    .seal span {
      font-weight: 900;
      letter-spacing: 1px;
      color: #0b1020;
      font-size: 12px;
      text-transform: uppercase;
    }
    .small {
      text-align: right;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.65);
      line-height: 1.4;
    }
    .qr-section {
      margin-top: 8px;
      text-align: center;
    }
    .qr-code-container {
      display: inline-block;
      padding: 8px;
      background: rgba(255, 255, 255, 0.10);
      border: 2px solid rgba(234, 179, 8, 0.30);
      border-radius: 8px;
      margin-bottom: 6px;
    }
    .qr-code-container img {
      display: block;
      width: 90px;
      height: 90px;
    }
    .qr-hint {
      font-size: 9px;
      color: rgba(255, 255, 255, 0.65);
      line-height: 1.3;
    }

    /* Print-friendly */
    @media print {
      body { background: #fff; }
      .sheet { margin: 0; padding: 0; }
      .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="card">
      <div class="bg"></div>
      <div class="grid"></div>

      <div class="content">
        <div class="top">
          <div class="brand">
            <div class="logo">' . (!empty($logo_url) ? '<img src="' . esc_url($logo_url) . '" alt="Play50Games Logo" />' : '') . '</div>
            <div>
              <h1>Play50Games</h1>
              <p>Skill & Focus Training</p>
            </div>
          </div>

          <div class="meta">
            <div class="pill"><span class="dot"></span> VERIFIED</div><br />
            Certificate ID: <strong>' . esc_html($cert_id_display) . '</strong><br />
            Issued: <strong>' . esc_html(date('d M Y', strtotime($completion_date))) . '</strong>
          </div>
        </div>

        <div class="main">
          <h2 class="title">Certificate of Achievement</h2>
          <p class="subtitle">
            This certificate is proudly presented for completing all 5 games and demonstrating
            exceptional skills in logic, memory, speed, and coordination.
          </p>

          <div class="name">' . esc_html($player_name) . '</div>
          <div class="underline"></div>

          <div class="details">
            <div class="detail">
              <div class="k">Completion Date</div>
              <div class="v">' . esc_html(date('F j, Y', strtotime($completion_date))) . '</div>
            </div>
            <div class="detail">
              <div class="k">Total Score</div>
              <div class="v">' . esc_html(number_format($total_score)) . '</div>
            </div>
            <div class="detail">
              <div class="k">Rank</div>
              <div class="v">' . esc_html($rank) . '</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <div class="sign">
            <div class="line"></div>
            <div class="label"><strong>Play50Games Team</strong></div>
          </div>

          <div class="seal" aria-hidden="true"><span>P50</span></div>

          <div class="small">
            <div class="qr-section">
              <div class="qr-code-container">
                <img src="' . esc_url($qr_code_url) . '" alt="QR Code" />
              </div>
              <div class="qr-hint">Scan to verify</div>
            </div>
            Issued by Play50Games • Digital Certificate<br />
            Verify with Certificate ID and issue date.
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>';
    
    return $html;
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
        $dompdf->setOptions($options);
        
    $dompdf->loadHtml($html);
    $dompdf->setPaper('A4', 'landscape');
    $dompdf->render();
        
        $upload_dir = wp_upload_dir();
        $certificates_dir = $upload_dir['basedir'] . '/play50-certificates';
        
        if (!file_exists($certificates_dir)) {
            wp_mkdir_p($certificates_dir);
        }
        
        $certificate_id = $certificate_data['certificate_id'];
        $filename = 'certificate-' . $certificate_id . '.pdf';
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

