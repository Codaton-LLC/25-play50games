'use client';

import { useState } from 'react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/Auth/LoginModal';
import RegisterModal from '@/components/Auth/RegisterModal';
import { EnvelopeIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function ContactUsPage() {
  const { user, isAuthenticated, login, register } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate form submission (you can replace this with actual API call)
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitted(false);
      }, 5000);
    }, 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="contact-page">
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

      <div className="contact-container">
        <div className="contact-header">
          <h1>Contact Us</h1>
          <p>Have a question or need help? We're here to assist you!</p>
        </div>

        <div className="contact-content">
          <div className="contact-info">
            <div className="info-card">
              <EnvelopeIcon style={{ width: 24, height: 24, color: 'var(--accent)' }} />
              <h3>Email</h3>
              <p>support@play50.games</p>
            </div>
            <div className="info-card">
              <MapPinIcon style={{ width: 24, height: 24, color: 'var(--ok)' }} />
              <h3>Support</h3>
              <p>Available 24/7</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="contact-form">
            {submitted && (
              <div className="success-message" style={{
                padding: '16px',
                backgroundColor: 'rgba(134, 239, 172, 0.15)',
                border: '1px solid rgba(134, 239, 172, 0.3)',
                borderRadius: '8px',
                color: 'var(--ok)',
                marginBottom: '20px',
              }}>
                Thank you for contacting us! We'll get back to you soon.
              </div>
            )}

            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Your name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your.email@example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="subject">Subject *</label>
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--stroke)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
              >
                <option value="">Select a subject</option>
                <option value="general">General Inquiry</option>
                <option value="technical">Technical Support</option>
                <option value="bug">Report a Bug</option>
                <option value="certificate">Certificate Issue</option>
                <option value="account">Account Issue</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="message">Message *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={6}
                placeholder="Tell us how we can help..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--stroke)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '12px 24px',
                backgroundColor: submitting ? 'rgba(125, 211, 252, 0.3)' : 'rgba(125, 211, 252, 0.14)',
                border: '1px solid rgba(125, 211, 252, 0.35)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!submitting) {
                  e.currentTarget.style.backgroundColor = 'rgba(125, 211, 252, 0.24)';
                  e.currentTarget.style.borderColor = 'rgba(125, 211, 252, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!submitting) {
                  e.currentTarget.style.backgroundColor = 'rgba(125, 211, 252, 0.14)';
                  e.currentTarget.style.borderColor = 'rgba(125, 211, 252, 0.35)';
                }
              }}
            >
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
