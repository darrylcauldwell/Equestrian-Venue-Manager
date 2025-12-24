import React, { useState } from 'react';
import './SocialShare.css';

interface SocialShareProps {
  title: string;
  description: string;
  date?: string;
  time?: string;
  location?: string;
  price?: string;
  url?: string;
  type: 'clinic' | 'event' | 'notice';
}

export const SocialShare: React.FC<SocialShareProps> = ({
  title,
  description,
  date,
  time,
  location,
  price,
  url,
  type,
}) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build the share text based on type
  const buildShareText = (): string => {
    const lines: string[] = [];

    // Add emoji based on type
    const emoji = type === 'clinic' ? '🐴' : type === 'event' ? '📅' : '📢';

    lines.push(`${emoji} ${title}`);
    lines.push('');

    if (description) {
      // Truncate description for social media
      const shortDesc = description.length > 200
        ? description.substring(0, 200) + '...'
        : description;
      lines.push(shortDesc);
      lines.push('');
    }

    if (date) {
      lines.push(`📆 ${date}${time ? ` at ${time}` : ''}`);
    }

    if (price) {
      lines.push(`💷 ${price}`);
    }

    if (location) {
      lines.push(`📍 ${location}`);
    }

    lines.push('');

    if (type === 'clinic') {
      lines.push('🏇 Limited spaces available - book now!');
    } else if (type === 'event') {
      lines.push('🎉 Everyone welcome!');
    }

    if (url) {
      lines.push('');
      lines.push(`More info: ${url}`);
    }

    return lines.join('\n');
  };

  const shareToFacebook = () => {
    const text = encodeURIComponent(buildShareText());
    const shareUrl = url ? encodeURIComponent(url) : '';

    // Facebook share dialog
    const facebookUrl = shareUrl
      ? `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${text}`
      : `https://www.facebook.com/sharer/sharer.php?quote=${text}`;

    window.open(facebookUrl, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(buildShareText());
    const whatsappUrl = `https://wa.me/?text=${text}`;

    window.open(whatsappUrl, '_blank');
    setShowShareMenu(false);
  };

  const copyToClipboard = async () => {
    const text = buildShareText();

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }

    setShowShareMenu(false);
  };

  const shareNative = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: title,
          text: buildShareText(),
          url: url,
        });
      } catch {
        // User cancelled share - no action needed
      }
      setShowShareMenu(false);
    } else {
      // Fallback to menu
      setShowShareMenu(true);
    }
  };

  return (
    <div className="social-share">
      <button
        className="share-button"
        onClick={() => setShowShareMenu(!showShareMenu)}
        title="Share"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <span>Share</span>
      </button>

      {showShareMenu && (
        <>
          <div className="share-overlay" onClick={() => setShowShareMenu(false)} />
          <div className="share-menu">
            <div className="share-menu-header">
              <h4>Share this {type}</h4>
              <button className="close-btn" onClick={() => setShowShareMenu(false)}>
                &times;
              </button>
            </div>

            <div className="share-options">
              {/* Native Share (mobile) */}
              {typeof navigator.share === 'function' && (
                <button className="share-option native" onClick={shareNative}>
                  <span className="share-icon">📱</span>
                  <span>Share...</span>
                </button>
              )}

              {/* Facebook */}
              <button className="share-option facebook" onClick={shareToFacebook}>
                <span className="share-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </span>
                <span>Facebook</span>
              </button>

              {/* WhatsApp */}
              <button className="share-option whatsapp" onClick={shareToWhatsApp}>
                <span className="share-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </span>
                <span>WhatsApp</span>
              </button>

              {/* Copy to Clipboard */}
              <button className="share-option copy" onClick={copyToClipboard}>
                <span className="share-icon">
                  {copied ? '✓' : '📋'}
                </span>
                <span>{copied ? 'Copied!' : 'Copy text'}</span>
              </button>
            </div>

            <div className="share-preview">
              <h5>Preview:</h5>
              <pre>{buildShareText()}</pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SocialShare;
