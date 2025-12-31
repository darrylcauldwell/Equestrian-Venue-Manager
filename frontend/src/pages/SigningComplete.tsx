import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { contractsApi } from '../services/api';

type SigningStatus = 'processing' | 'success' | 'declined' | 'error';

export default function SigningComplete() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SigningStatus>('processing');
  const [message, setMessage] = useState('Processing your signature...');

  const handleSigningCallback = useCallback(async () => {
    const event = searchParams.get('event');
    const envelopeId = searchParams.get('envelope_id');
    const signatureId = searchParams.get('signature_id');

    // DocuSign event types:
    // signing_complete - User completed signing
    // decline - User declined to sign
    // cancel - User cancelled the signing
    // session_timeout - Session timed out
    // viewing_complete - User finished viewing

    if (event === 'signing_complete' && signatureId && envelopeId) {
      try {
        await contractsApi.completeSigning(parseInt(signatureId), {
          event: 'signing_complete',
          envelope_id: envelopeId,
        });
        setStatus('success');
        setMessage('Thank you! Your contract has been signed successfully.');
      } catch (err) {
        console.error('Failed to complete signing:', err);
        setStatus('error');
        setMessage('There was an issue recording your signature. Please contact support.');
      }
    } else if (event === 'decline') {
      setStatus('declined');
      setMessage('You have declined to sign this contract. Please contact us if you have any questions.');
    } else if (event === 'cancel' || event === 'session_timeout') {
      setStatus('error');
      setMessage('The signing session was cancelled. You can try again from your contracts page.');
    } else {
      // Unknown event or missing parameters
      setStatus('error');
      setMessage('Invalid signing callback. Please return to your contracts page.');
    }
  }, [searchParams]);

  useEffect(() => {
    handleSigningCallback();
  }, [handleSigningCallback]);

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="status-icon processing">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
        );
      case 'success':
        return (
          <div className="status-icon success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22,4 12,14.01 9,11.01" />
            </svg>
          </div>
        );
      case 'declined':
        return (
          <div className="status-icon declined">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="status-icon error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="signing-complete-page">
      <div className="signing-complete-card">
        {getStatusIcon()}
        <h1>
          {status === 'processing' && 'Processing'}
          {status === 'success' && 'Success!'}
          {status === 'declined' && 'Declined'}
          {status === 'error' && 'Oops!'}
        </h1>
        <p>{message}</p>
        {status !== 'processing' && (
          <button
            className="ds-btn ds-btn-primary"
            onClick={() => navigate('/my-contracts')}
          >
            View My Contracts
          </button>
        )}
      </div>

      <style>{`
        .signing-complete-page {
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .signing-complete-card {
          background: #fff;
          border-radius: 12px;
          padding: 48px;
          text-align: center;
          max-width: 480px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
        }

        .status-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .status-icon svg {
          width: 48px;
          height: 48px;
        }

        .status-icon.processing {
          background: #dbeafe;
          color: #2563eb;
          animation: pulse 2s infinite;
        }

        .status-icon.success {
          background: #d1fae5;
          color: #059669;
        }

        .status-icon.declined {
          background: #fef3c7;
          color: #d97706;
        }

        .status-icon.error {
          background: #fee2e2;
          color: #dc2626;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .signing-complete-card h1 {
          margin: 0 0 16px;
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
        }

        .signing-complete-card p {
          margin: 0 0 24px;
          font-size: 16px;
          color: #4b5563;
          line-height: 1.5;
        }

        @media (prefers-color-scheme: dark) {
          .signing-complete-card {
            background: #1f2937;
          }

          .signing-complete-card h1 {
            color: #f3f4f6;
          }

          .signing-complete-card p {
            color: #9ca3af;
          }
        }
      `}</style>
    </div>
  );
}
