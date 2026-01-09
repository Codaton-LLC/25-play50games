'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Certificate } from '@/types/game';
import { generateCertificate, getCertificate, getUserCertificate } from '@/lib/api/certificate';
import { getAllProgress } from '@/lib/storage/progressStorage';
import { getAllGames } from '@/lib/api/games';
import { getGuestId } from '@/lib/storage/progressStorage';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/Auth/LoginModal';
import RegisterModal from '@/components/Auth/RegisterModal';
import Header from '@/components/Header/Header';

export default function CertificatePage() {
  const { user, isAuthenticated, isLoading: authLoading, login, register } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCertificate, setLoadingCertificate] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [canGenerate, setCanGenerate] = useState(false);
  const [guestId] = useState(() => getGuestId());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const checkCompletion = async () => {
    try {
      const progress = await getAllProgress(); // Now async - gets from server for logged-in users
      const games = await getAllGames(guestId);
      
      const completedCount = games.filter(game => {
        const gameProgress = progress[game.id];
        return gameProgress && gameProgress.completed;
      }).length;
      
      setCanGenerate(completedCount >= 50);
    } catch (error) {
      // Failed to check completion
    }
  };

  const loadUserCertificate = async () => {
    setLoadingCertificate(true);
    try {
      const userCert = await getUserCertificate();
      console.log('Loaded user certificate:', userCert);
      if (userCert && userCert.certificate_id && userCert.player_name) {
        setCertificate(userCert);
      } else {
        setCertificate(null);
      }
    } catch (error) {
      console.error('Error loading user certificate:', error);
      setCertificate(null);
    } finally {
      setLoadingCertificate(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      // Set player name from user data
      const name = user.display_name || 
                   (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email);
      setPlayerName(name);
      checkCompletion();
      loadUserCertificate();
    } else {
      setLoadingCertificate(false);
      setCertificate(null);
    }
  }, [isAuthenticated, user]);

  const handleGenerate = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const result = await generateCertificate(playerName, guestId);
      console.log('Certificate generated:', result);
      // Set certificate from result directly
      if (result.data && result.data.certificate_id) {
        setCertificate(result.data);
        setLoadingCertificate(false); // Make sure loading is false so it shows the certificate
      } else {
        // If result.data doesn't have certificate_id, reload from server
        await loadUserCertificate();
      }
    } catch (error: any) {
      console.error('Error generating certificate:', error);
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

  const getCertificateUrl = () => {
    if (certificate) {
      // If pdf_path exists, use it directly
      if (certificate.pdf_path) {
        return certificate.pdf_path;
      }
      // Otherwise, construct the PDF URL based on certificate_id
      return `https://cms.play50.games/wp-content/uploads/play50-certificates/certificate-${certificate.certificate_id}.pdf`;
    }
    return '';
  };

  const generateCertificateHTML = (cert: Certificate) => {
    const certUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/certificate/${cert.certificate_id}`
      : '';
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate - ${cert.player_name}</title>
    <style>
        @page { size: A4 landscape; margin: 0; }
        body { 
            font-family: system-ui, -apple-system, 'Segoe UI', 'Roboto', sans-serif; 
            margin: 0; 
            padding: 40px; 
            background: radial-gradient(1000px 600px at 20% 10%, rgba(125, 211, 252, 0.20), transparent 60%),
              radial-gradient(900px 550px at 80% 30%, rgba(134, 239, 172, 0.16), transparent 60%),
              radial-gradient(900px 650px at 60% 90%, rgba(252, 165, 165, 0.14), transparent 60%),
              #0b1020;
            color: rgba(255, 255, 255, 0.92);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .certificate { 
            background: rgba(255, 255, 255, 0.06);
            padding: 60px; 
            border: 2px solid rgba(255, 255, 255, 0.12);
            text-align: center; 
            max-width: 900px;
            width: 100%;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
        }
        .certificate-header { 
            font-size: 48px; 
            font-weight: bold; 
            color: rgba(255, 255, 255, 0.92); 
            margin-bottom: 20px; 
        }
        .player-name { 
            font-size: 42px; 
            font-weight: bold; 
            color: #7dd3fc; 
            margin: 30px 0; 
            padding: 20px; 
            border-top: 2px solid rgba(255, 255, 255, 0.12);
            border-bottom: 2px solid rgba(255, 255, 255, 0.12);
        }
        .certificate-text {
            color: rgba(255, 255, 255, 0.70);
            font-size: 18px;
            margin: 20px 0;
        }
        .certificate-details {
            display: flex;
            justify-content: space-around;
            margin: 40px 0;
            padding: 20px;
            background: rgba(255, 255, 255, 0.03);
        }
        .detail-item {
            text-align: center;
        }
        .detail-label {
            display: block;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.70);
            margin-bottom: 8px;
        }
        .detail-value {
            display: block;
            font-size: 20px;
            font-weight: bold;
            color: rgba(255, 255, 255, 0.92);
        }
        .certificate-id {
            margin-top: 30px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.03);
            color: rgba(255, 255, 255, 0.70);
            font-size: 12px;
            font-family: monospace;
        }
        .qr-section {
            margin: 30px 0;
            padding: 20px;
        }
        .qr-hint {
            margin-top: 10px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.70);
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="certificate-header">Certificate of Completion</div>
        <p class="certificate-text">This is to certify that</p>
        <div class="player-name">${cert.player_name}</div>
        <p class="certificate-text">
            has successfully completed all 50 games<br />
            demonstrating exceptional skills in logic, memory, speed, and coordination.
        </p>
        <div class="certificate-details">
            <div class="detail-item">
                <span class="detail-label">Completion Date</span>
                <span class="detail-value">${new Date(cert.completion_date).toLocaleDateString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Total Score</span>
                <span class="detail-value">${cert.total_score}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Rank</span>
                <span class="detail-value">${cert.rank}</span>
            </div>
        </div>
        ${certUrl ? `<div class="qr-section">
            <p class="qr-hint">Scan QR code to verify this certificate online</p>
            <p class="qr-hint">${certUrl}</p>
        </div>` : ''}
        <div class="certificate-id">
            Certificate ID: ${cert.cert_id_display || cert.certificate_id}
        </div>
    </div>
</body>
</html>`;
  };

  if (authLoading) {
    return (
      <div className="certificate-page">
        <div className="certificate-loading">
          <span className="loader"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="certificate-page">
      <Header
        showSubtitle={false}
        onShowLoginModal={() => setShowLoginModal(true)}
        onShowRegisterModal={() => setShowRegisterModal(true)}
      />

      {/* Auth Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={login}
        onSwitchToRegister={() => {
          setShowLoginModal(false);
          setShowRegisterModal(true);
        }}
      />
      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onRegister={register}
        onSwitchToLogin={() => {
          setShowRegisterModal(false);
          setShowLoginModal(true);
        }}
      />

      {!isAuthenticated ? (
        <div className="certificate-generate">
          <div className="login-required">
            <div className="login-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="30" stroke="var(--accent)" strokeWidth="3" fill="none"/>
                <path d="M32 20 L32 32 M32 32 L40 40 M32 32 L24 40" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 48 C20 42 25 38 32 38 C39 38 44 42 44 48" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <h2>Login Required</h2>
            <p>You must be logged in to generate your certificate.</p>
            <p className="login-hint">Please log in or create an account to access certificate generation.</p>
            <div className="login-actions">
              <button onClick={() => setShowLoginModal(true)} className="login-button">
                Log In
              </button>
              <button onClick={() => setShowRegisterModal(true)} className="register-button">
                Create Account
              </button>
            </div>
          </div>
        </div>
      ) : loadingCertificate ? (
        <div className="certificate-generate">
          <div className="certificate-loading">
            <span className="loader"></span>
            <p>Loading certificate...</p>
          </div>
        </div>
      ) : certificate && certificate.certificate_id ? (
        <div className="certificate-generate">
          <div className="certificate-exists">
            <div className="certificate-badge-icon">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="38" stroke="var(--accent)" strokeWidth="4" fill="none"/>
                <path d="M25 40 L35 50 L55 30" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>Certificate Generated</h2>
            <p>You have successfully generated your certificate!</p>
            <div style={{ margin: '30px 0' }}>
              <Link href={`/certificate/${certificate.certificate_id}`} className="view-certificate-button">
                View Certificate
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="certificate-generate">
          {canGenerate ? (
            <>
              <h2>Generate Your Certificate</h2>
              <p>Congratulations! You've completed all 50 games.</p>
              <div className="name-display">
                <div className="player-name-display" style={{
                  fontSize: '50px',
                  fontWeight: '700',
                  color: 'var(--accent)',
                  textAlign: 'center',
                  margin: '30px 0',
                  padding: '20px',
                  borderTop: '2px solid var(--stroke)',
                  borderBottom: '2px solid var(--stroke)',
                }}>
                  {playerName}
                </div>
                <small style={{ display: 'block', marginTop: '8px', marginBottom: '25px', color: 'var(--muted)', fontSize: '12px', textAlign: 'center' }}>
                  Name is taken from your account
                </small>
              </div>
              <button onClick={handleGenerate} disabled={loading || !playerName.trim()}>
                Generate Certificate
              </button>
            </>
          ) : (
            <div className="not-ready">
              <h2>Complete All Games First</h2>
              <p>You need to complete all 50 games to generate your certificate.</p>
              <Link href="/">Go to Games</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

