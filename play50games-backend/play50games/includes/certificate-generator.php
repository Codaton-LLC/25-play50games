<?php
/**
 * Play50Games Certificate Generator
 * Generates PDF certificates for completed games
 */

/**
 * Generate certificate PDF (or HTML if PDF library not available)
 */
function play50_generate_certificate_pdf($post_id, $certificate_data) {
    // Check if DomPDF or FPDF is available
    // For now, we'll create a simple implementation that can be extended
    
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
    
    // For now, we'll create a simple HTML version that can be converted to PDF
    // In production, you would use DomPDF or FPDF library
    
    $html = play50_generate_certificate_html($certificate_data);
    
    // Save HTML version (can be converted to PDF later with a library)
    $html_path = str_replace('.pdf', '.html', $filepath);
    file_put_contents($html_path, $html);
    
    // Return URL for now (PDF generation would require DomPDF/FPDF library)
    // To implement PDF generation, install: composer require dompdf/dompdf
    return $url;
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
    
    $html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate of Completion - Play50Games</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 0;
        }
        body {
            font-family: "Times New Roman", serif;
            margin: 0;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .certificate {
            background: white;
            padding: 60px;
            border: 20px solid #FFD700;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 900px;
            width: 100%;
        }
        .certificate-header {
            font-size: 48px;
            font-weight: bold;
            color: #091057;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 3px;
        }
        .certificate-subtitle {
            font-size: 24px;
            color: #666;
            margin-bottom: 40px;
        }
        .player-name {
            font-size: 42px;
            font-weight: bold;
            color: #FF6900;
            margin: 30px 0;
            padding: 20px;
            border-bottom: 3px solid #091057;
            border-top: 3px solid #091057;
        }
        .certificate-text {
            font-size: 20px;
            color: #333;
            line-height: 1.8;
            margin: 30px 0;
        }
        .certificate-details {
            display: flex;
            justify-content: space-around;
            margin: 40px 0;
            padding: 20px;
            background: #f7f7f8;
        }
        .detail-item {
            text-align: center;
        }
        .detail-label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .detail-value {
            font-size: 24px;
            font-weight: bold;
            color: #091057;
            margin-top: 10px;
        }
        .certificate-id {
            font-size: 12px;
            color: #999;
            margin-top: 40px;
            font-family: monospace;
        }
        .certificate-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            font-size: 16px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="certificate-header">Certificate of Completion</div>
        <div class="certificate-subtitle">Play50Games Platform</div>
        
        <div class="certificate-text">
            This is to certify that
        </div>
        
        <div class="player-name">' . $player_name . '</div>
        
        <div class="certificate-text">
            has successfully completed all 5 games<br>
            demonstrating exceptional skills in logic, memory, speed, and coordination.
        </div>
        
        <div class="certificate-details">
            <div class="detail-item">
                <div class="detail-label">Completion Date</div>
                <div class="detail-value">' . date('F j, Y', strtotime($completion_date)) . '</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Total Score</div>
                <div class="detail-value">' . $total_score . '</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Rank</div>
                <div class="detail-value">' . $rank . '</div>
            </div>
        </div>
        
        <div class="certificate-footer">
            <strong>Play50Games</strong><br>
            Learn. Play. Achieve.
        </div>
        
        <div class="certificate-id">
            Certificate ID: ' . $certificate_id . '
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
    // Check if DomPDF is available
    if (!class_exists('Dompdf\Dompdf')) {
        // Try to load via Composer autoload
        $composer_autoload = get_stylesheet_directory() . '/vendor/autoload.php';
        if (file_exists($composer_autoload)) {
            require_once $composer_autoload;
        } else {
            return false; // DomPDF not available
        }
    }
    
    $html = play50_generate_certificate_html($certificate_data);
    
    $dompdf = new \Dompdf\Dompdf();
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
    
    file_put_contents($filepath, $dompdf->output());
    
    return $upload_dir['baseurl'] . '/play50-certificates/' . $filename;
}

