'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/Auth/LoginModal';
import RegisterModal from '@/components/Auth/RegisterModal';
import { Certificate } from '@/types/game';
import { getApiHeaders } from '@/lib/api/apiUtils';

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const { user, isAuthenticated, login, register } = useAuth();
  const [certId, setCertId] = useState('');
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Get cert_id from URL query parameter
  useEffect(() => {
    const certIdParam = searchParams.get('cert_id');
    if (certIdParam) {
      setCertId(certIdParam);
      handleVerify(certIdParam);
    }
  }, [searchParams]);

  const handleVerify = async (certIdToVerify?: string) => {
    const idToVerify = certIdToVerify || certId.trim();
    
    if (!idToVerify) {
      setError('Please enter a Certificate ID');
      return;
    }

    setLoading(true);
    setError(null);
    setCertificate(null);

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/certificate/verify/${encodeURIComponent(idToVerify)}`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Certificate not found');
      }

      const certData = await response.json();
      setCertificate(certData);
    } catch (err: any) {
      setError(err.message || 'Failed to verify certificate');
      setCertificate(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  const getPdfUrl = () => {
    if (!certificate) return '';
    
    if (certificate.pdf_path) {
      return certificate.pdf_path;
    }
    
    // Construct PDF URL based on certificate_id
    const uploadBase = 'https://cms.play50.games/wp-content/uploads/play50-certificates';
    const playerName = certificate.player_name || 'player';
    const nameParts = playerName.split(' ');
    const firstname = nameParts[0]?.toLowerCase() || 'player';
    const lastname = nameParts[1]?.toLowerCase() || '';
    const nameSlug = lastname ? `${firstname}-${lastname}` : firstname;
    const certIdDisplay = certificate.cert_id_display || certificate.certificate_id;
    
    return `${uploadBase}/${nameSlug}-${certIdDisplay}.pdf`;
  };

  return (
    <div className="verify-page">
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

      <div className="verify-container">
        <div className="verify-header">
          <h1>Verify Certificate</h1>
          <p>Enter the Certificate ID to verify and view the certificate</p>
        </div>

        <form onSubmit={handleSubmit} className="verify-form">
          <div className="form-group">
            <label htmlFor="certId">Certificate ID</label>
            <input
              type="text"
              id="certId"
              value={certId}
              onChange={(e) => setCertId(e.target.value.toUpperCase())}
              placeholder="e.g., P50-2026-56966"
              disabled={loading}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--stroke)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '14px',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !certId.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? 'rgba(125, 211, 252, 0.3)' : 'rgba(125, 211, 252, 0.14)',
              border: '1px solid rgba(125, 211, 252, 0.35)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? 'Verifying...' : 'Verify Certificate'}
          </button>
        </form>

        {error && (
          <div className="error-message" style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'rgba(252, 165, 165, 0.15)',
            border: '1px solid rgba(252, 165, 165, 0.3)',
            borderRadius: '8px',
            color: 'var(--warn)',
          }}>
            {error}
          </div>
        )}

        {certificate && (
          <div className="certificate-display" style={{ marginTop: '40px' }}>
            <div className="certificate-info" style={{
              marginBottom: '20px',
              padding: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--stroke)',
              borderRadius: '12px',
            }}>
              <h2 style={{ marginBottom: '16px', color: 'var(--text)' }}>
                Certificate Verified ✓
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Player Name</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
                    {certificate.player_name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Certificate ID</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace' }}>
                    {certificate.cert_id_display || certificate.certificate_id}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Completion Date</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
                    {new Date(certificate.completion_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Rank</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
                    {certificate.rank}
                  </div>
                </div>
              </div>
            </div>

            <div className="pdf-viewer" style={{
              width: '100%',
              height: '800px',
              border: '1px solid var(--stroke)',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#f5f5f5',
            }}>
              <iframe
                src={getPdfUrl()}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
                title="Certificate PDF"
              />
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// Helper function
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    if (envUrl) return envUrl;
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('play50.games')) {
      return 'https://cms.play50.games/wp-json/play50/v1';
    }
    if (currentOrigin.includes('play50.game')) {
      return 'https://cms.play50.game/wp-json/play50/v1';
    }
    return 'http://localhost/wp-json/play50/v1';
  }
  return process.env.WORDPRESS_API_URL || 'http://localhost/wp-json/play50/v1';
}
