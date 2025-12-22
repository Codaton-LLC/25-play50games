'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Certificate } from '@/types/game';
import { generateCertificate, getCertificate } from '@/lib/api/certificate';
import { getAllProgress } from '@/lib/storage/progressStorage';
import { getAllGames } from '@/lib/api/games';
import { getGuestId } from '@/lib/storage/progressStorage';

export default function CertificatePage() {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [canGenerate, setCanGenerate] = useState(false);
  const [guestId] = useState(() => getGuestId());

  useEffect(() => {
    checkCompletion();
  }, []);

  const checkCompletion = async () => {
    try {
      const progress = getAllProgress();
      const games = await getAllGames(guestId);
      
      const completedCount = games.filter(game => {
        const gameProgress = progress[game.id];
        return gameProgress && gameProgress.completed;
      }).length;
      
      setCanGenerate(completedCount >= 5);
    } catch (error) {
      console.error('Failed to check completion:', error);
    }
  };

  const handleGenerate = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const result = await generateCertificate(playerName, guestId);
      setCertificate(result.data);
    } catch (error: any) {
      alert(error.message || 'Failed to generate certificate');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (certificate?.pdf_path) {
      window.open(certificate.pdf_path, '_blank');
    } else {
      // Generate download from HTML
      const html = generateCertificateHTML(certificate!);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${certificate!.certificate_id}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const generateCertificateHTML = (cert: Certificate) => {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate - ${cert.player_name}</title>
    <style>
        body { font-family: 'Times New Roman', serif; margin: 0; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .certificate { background: white; padding: 60px; border: 20px solid #FFD700; text-align: center; }
        .certificate-header { font-size: 48px; font-weight: bold; color: #091057; margin-bottom: 20px; }
        .player-name { font-size: 42px; font-weight: bold; color: #FF6900; margin: 30px 0; padding: 20px; border: 3px solid #091057; }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="certificate-header">Certificate of Completion</div>
        <div class="player-name">${cert.player_name}</div>
        <p>has successfully completed all 5 games</p>
        <p>Date: ${new Date(cert.completion_date).toLocaleDateString()}</p>
        <p>Score: ${cert.total_score} | Rank: ${cert.rank}</p>
        <p>Certificate ID: ${cert.certificate_id}</p>
    </div>
</body>
</html>`;
  };

  return (
    <div className="certificate-page">
      <header>
        <h1>Certificate</h1>
        <Link href="/">← Back to Games</Link>
      </header>

      {!certificate ? (
        <div className="certificate-generate">
          {canGenerate ? (
            <>
              <h2>Generate Your Certificate</h2>
              <p>Congratulations! You've completed all 5 games.</p>
              <div className="name-input">
                <label>Enter your name:</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your Name"
                />
              </div>
              <button onClick={handleGenerate} disabled={loading || !playerName.trim()}>
                {loading ? 'Generating...' : 'Generate Certificate'}
              </button>
            </>
          ) : (
            <div className="not-ready">
              <h2>Complete All Games First</h2>
              <p>You need to complete all 5 games to generate your certificate.</p>
              <Link href="/">Go to Games</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="certificate-view">
          <div className="certificate-display">
            <h2>Certificate of Completion</h2>
            <div className="certificate-content">
              <p className="certificate-text">This is to certify that</p>
              <div className="player-name-large">{certificate.player_name}</div>
              <p className="certificate-text">
                has successfully completed all 5 games<br />
                demonstrating exceptional skills in logic, memory, speed, and coordination.
              </p>
              <div className="certificate-details">
                <div>
                  <strong>Completion Date:</strong> {new Date(certificate.completion_date).toLocaleDateString()}
                </div>
                <div>
                  <strong>Total Score:</strong> {certificate.total_score}
                </div>
                <div>
                  <strong>Rank:</strong> {certificate.rank}
                </div>
              </div>
              <div className="certificate-id">
                Certificate ID: {certificate.certificate_id}
              </div>
            </div>
          </div>
          <div className="certificate-actions">
            <button onClick={handleDownload}>Download Certificate</button>
            <Link href="/">Back to Games</Link>
          </div>
        </div>
      )}
    </div>
  );
}

