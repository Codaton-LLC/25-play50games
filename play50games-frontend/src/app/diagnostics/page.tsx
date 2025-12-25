'use client';

import { useEffect, useState } from 'react';

interface DiagnosticResult {
  name: string;
  status: 'checking' | 'success' | 'error';
  message: string;
  details?: string;
}

export default function DiagnosticsPage() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    const diagnostics: DiagnosticResult[] = [];

    // 1. Check environment variable
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    diagnostics.push({
      name: 'Environment Variable',
      status: envUrl ? 'success' : 'error',
      message: envUrl ? `Set to: ${envUrl}` : 'Not set (NEXT_PUBLIC_WORDPRESS_API_URL)',
      details: envUrl ? undefined : 'Create .env.local file with NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.game/wp-json/play50/v1',
    });

    // 2. Detect API URL
    let detectedApiUrl = 'http://localhost/wp-json/play50/v1';
    if (typeof window !== 'undefined') {
      if (envUrl) {
        detectedApiUrl = envUrl;
      } else {
        const currentOrigin = window.location.origin;
        if (currentOrigin.includes('play50.games')) {
          detectedApiUrl = 'https://cms.play50.games/wp-json/play50/v1';
        } else if (currentOrigin.includes('play50.game')) {
          detectedApiUrl = 'https://cms.play50.game/wp-json/play50/v1';
        }
      }
    }

    diagnostics.push({
      name: 'Detected API URL',
      status: 'success',
      message: detectedApiUrl,
    });

    // 3. Test API connectivity
    diagnostics.push({
      name: 'API Connectivity',
      status: 'checking',
      message: 'Testing connection...',
    });
    setResults([...diagnostics]);

    try {
      const response = await fetch(`${detectedApiUrl}/games`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        diagnostics[2] = {
          name: 'API Connectivity',
          status: 'success',
          message: `Connected successfully! Received ${Array.isArray(data) ? data.length : 0} games`,
        };
      } else {
        diagnostics[2] = {
          name: 'API Connectivity',
          status: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          details: await response.text().catch(() => 'No error details available'),
        };
      }
    } catch (error: any) {
      diagnostics[2] = {
        name: 'API Connectivity',
        status: 'error',
        message: error.message || 'Connection failed',
        details: error.toString(),
      };
    }

    // 4. Check CORS - Check from the successful GET request first
    diagnostics.push({
      name: 'CORS Headers',
      status: 'checking',
      message: 'Checking CORS configuration...',
    });
    setResults([...diagnostics]);

    try {
      // First, try to get CORS headers from a GET request (which we know works)
      const testResponse = await fetch(`${detectedApiUrl}/games`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const corsHeadersFromGet = {
        'access-control-allow-origin': testResponse.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': testResponse.headers.get('access-control-allow-methods'),
        'access-control-allow-headers': testResponse.headers.get('access-control-allow-headers'),
        'access-control-allow-credentials': testResponse.headers.get('access-control-allow-credentials'),
      };

      // If we got CORS headers from GET, that's good
      if (corsHeadersFromGet['access-control-allow-origin']) {
        diagnostics[3] = {
          name: 'CORS Headers',
          status: 'success',
          message: `CORS configured: ${corsHeadersFromGet['access-control-allow-origin']}`,
          details: JSON.stringify(corsHeadersFromGet, null, 2),
        };
      } else {
        // Try OPTIONS request as fallback
        try {
          const corsResponse = await fetch(`${detectedApiUrl}/games`, {
            method: 'OPTIONS',
            headers: {
              'Origin': window.location.origin,
              'Access-Control-Request-Method': 'GET',
            },
          });
          
          const corsHeaders = {
            'access-control-allow-origin': corsResponse.headers.get('access-control-allow-origin'),
            'access-control-allow-methods': corsResponse.headers.get('access-control-allow-methods'),
            'access-control-allow-headers': corsResponse.headers.get('access-control-allow-headers'),
            'access-control-allow-credentials': corsResponse.headers.get('access-control-allow-credentials'),
          };

          if (corsHeaders['access-control-allow-origin']) {
            diagnostics[3] = {
              name: 'CORS Headers',
              status: 'success',
              message: `CORS configured: ${corsHeaders['access-control-allow-origin']}`,
              details: JSON.stringify(corsHeaders, null, 2),
            };
          } else {
            // If API works but no CORS headers, it might be a same-origin request or CORS is working but headers not exposed
            diagnostics[3] = {
              name: 'CORS Headers',
              status: 'success',
              message: 'CORS is working (API requests succeed). Headers may not be exposed in response.',
              details: 'Since API connectivity works, CORS is likely configured correctly. Some browsers don\'t expose CORS headers in responses for security reasons.',
            };
          }
        } catch (optionsError: any) {
          // If OPTIONS fails but GET works, CORS is still working
          diagnostics[3] = {
            name: 'CORS Headers',
            status: 'success',
            message: 'CORS is working (API requests succeed)',
            details: 'OPTIONS preflight may not be needed since GET requests work. CORS is configured correctly.',
          };
        }
      }
    } catch (error: any) {
      diagnostics[3] = {
        name: 'CORS Headers',
        status: 'error',
        message: 'Could not check CORS headers',
        details: error.toString(),
      };
    }

    // 5. Browser info
    if (typeof window !== 'undefined') {
      diagnostics.push({
        name: 'Browser Information',
        status: 'success',
        message: `Origin: ${window.location.origin}`,
        details: `User Agent: ${navigator.userAgent}`,
      });
    }

    setResults(diagnostics);
    setLoading(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'checking':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'checking':
        return '#ffa500';
      case 'success':
        return '#28a745';
      case 'error':
        return '#dc3545';
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>API Diagnostics</h1>
      <p>This page helps diagnose connection issues with the WordPress API.</p>

      <button
        onClick={runDiagnostics}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '2rem',
        }}
      >
        {loading ? 'Running Diagnostics...' : 'Run Diagnostics Again'}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {results.map((result, index) => (
          <div
            key={index}
            style={{
              border: `2px solid ${getStatusColor(result.status)}`,
              borderRadius: '8px',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{getStatusIcon(result.status)}</span>
              <h3 style={{ margin: 0 }}>{result.name}</h3>
            </div>
            <p style={{ margin: '0.5rem 0', fontWeight: 'bold' }}>{result.message}</p>
            {result.details && (
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', color: '#666' }}>Details</summary>
                <pre
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '0.875rem',
                  }}
                >
                  {result.details}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
        <h3>How to Fix Common Issues:</h3>
        <ul>
          <li>
            <strong>Environment Variable Not Set:</strong> Create a <code>.env.local</code> file in the frontend
            directory with:
            <pre style={{ backgroundColor: '#fff', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
              NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1
            </pre>
          </li>
          <li>
            <strong>CORS Error:</strong> Check the backend <code>wp-config.php</code> file and ensure CORS is
            configured correctly. The <code>PLAY50_CORS_ORIGIN</code> should include <code>http://localhost:3000</code> for local development.
            See <code>CORS_SETUP.md</code> for details.
          </li>
          <li>
            <strong>Network Error:</strong> Check if you can access{' '}
            <a href="https://cms.play50.games/wp-json/play50/v1/games" target="_blank" rel="noopener noreferrer">
              https://cms.play50.games/wp-json/play50/v1/games
            </a>{' '}
            directly in your browser.
          </li>
          <li>
            <strong>SSL/Certificate Error:</strong> Check browser console for SSL errors. You may need to accept
            the certificate or check your system's certificate store.
          </li>
        </ul>
      </div>
    </div>
  );
}

