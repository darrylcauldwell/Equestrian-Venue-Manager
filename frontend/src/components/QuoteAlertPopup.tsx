import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { servicesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { ServiceRequest } from '../types';
import './QuoteAlertPopup.css';

const DISMISSAL_KEY = 'quote-alert-dismissed';
const DISMISSAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function QuoteAlertPopup() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<ServiceRequest[]>([]);
  const [dismissed, setDismissed] = useState(() => {
    // Check sessionStorage for dismissal (persists across navigation)
    const stored = sessionStorage.getItem(DISMISSAL_KEY);
    if (stored) {
      const { timestamp } = JSON.parse(stored);
      // Only respect dismissal if within expiry period
      if (Date.now() - timestamp < DISMISSAL_EXPIRY_MS) {
        return true;
      }
      sessionStorage.removeItem(DISMISSAL_KEY);
    }
    return false;
  });
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    // Only check for quotes for livery users
    if (user && user.role === 'livery' && !dismissed) {
      loadQuotes();
    }
  }, [user, dismissed]);

  const loadQuotes = async () => {
    try {
      const data = await servicesApi.getMyRequests();
      // Get quoted requests (have a quote awaiting response)
      setQuotes(data.quoted_requests || []);
    } catch (error) {
      console.error('Failed to load quote notifications:', error);
    }
  };

  const handleDismiss = () => {
    // Persist dismissal to sessionStorage
    sessionStorage.setItem(DISMISSAL_KEY, JSON.stringify({ timestamp: Date.now() }));
    setDismissed(true);
  };

  const handleAccept = async (request: ServiceRequest) => {
    try {
      setProcessing(request.id);
      await servicesApi.acceptQuote(request.id);
      setQuotes((prev) => prev.filter((q) => q.id !== request.id));
    } catch (error) {
      console.error('Failed to accept quote:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (request: ServiceRequest) => {
    if (!confirm('Decline this quote? This will cancel the request.')) return;
    try {
      setProcessing(request.id);
      await servicesApi.rejectQuote(request.id);
      setQuotes((prev) => prev.filter((q) => q.id !== request.id));
    } catch (error) {
      console.error('Failed to decline quote:', error);
    } finally {
      setProcessing(null);
    }
  };

  const formatPrice = (price: number | string | undefined) => {
    if (price === undefined || price === null) return '£0.00';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `£${numPrice.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };

  // Don't show if no quotes or dismissed
  if (dismissed || quotes.length === 0) {
    return null;
  }

  return (
    <div className="quote-alert-popup-overlay">
      <div className="quote-alert-popup">
        <div className="popup-header">
          <div className="popup-icon">£</div>
          <h2>Quote Ready</h2>
          <button className="close-btn" onClick={handleDismiss} title="Dismiss">
            &times;
          </button>
        </div>

        <p className="popup-intro">
          You have {quotes.length === 1 ? 'a quote' : 'quotes'} awaiting your response.
        </p>

        <div className="popup-quotes">
          {quotes.map((quote) => (
            <div key={quote.id} className="popup-quote-item">
              <div className="quote-content">
                <strong className="service-name">{quote.service_name}</strong>
                <span className="horse-name">for {quote.horse_name}</span>
                <span className="quote-date">{formatDate(quote.requested_date)}</span>
                {quote.quote_notes && (
                  <span className="quote-notes">{quote.quote_notes}</span>
                )}
                <span className="quote-price">{formatPrice(quote.quote_amount)}</span>
              </div>
              <div className="quote-actions">
                <button
                  className="accept-btn"
                  onClick={() => handleAccept(quote)}
                  disabled={processing === quote.id}
                >
                  {processing === quote.id ? '...' : 'Accept'}
                </button>
                <button
                  className="decline-btn"
                  onClick={() => handleDecline(quote)}
                  disabled={processing === quote.id}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="popup-footer">
          <Link to="/book/livery-services" className="view-all-btn" onClick={handleDismiss}>
            View All Requests
          </Link>
          <button className="dismiss-btn" onClick={handleDismiss}>
            Decide Later
          </button>
        </div>
      </div>
    </div>
  );
}
