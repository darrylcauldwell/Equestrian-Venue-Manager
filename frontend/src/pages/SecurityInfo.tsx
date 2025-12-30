import { useSettings } from '../contexts/SettingsContext';
import './SecurityInfo.css';

export function SecurityInfo() {
  const { venueName, settings } = useSettings();

  const hasSecurityInfo = settings?.gate_code || settings?.key_safe_code || settings?.security_info;

  return (
    <div className="security-info-page">
      <div className="page-header">
        <h1>Yard Security</h1>
        <p>Important access and security information for {venueName}</p>
      </div>

      {!hasSecurityInfo ? (
        <div className="no-security-info">
          <p>No security information has been configured yet.</p>
          <p>Please contact the yard manager for access details.</p>
        </div>
      ) : (
        <div className="security-content">
          {(settings?.gate_code || settings?.key_safe_code) && (
            <div className="security-codes-row">
              {settings?.gate_code && (
                <div className="security-card gate-code-card">
                  <div className="security-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                  <div className="security-card-content">
                    <h2>Gate Padlock Code</h2>
                    <div className="gate-code">{settings.gate_code}</div>
                  </div>
                </div>
              )}

              {settings?.key_safe_code && (
                <div className="security-card gate-code-card">
                  <div className="security-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                      <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                    </svg>
                  </div>
                  <div className="security-card-content">
                    <h2>Key Safe Code</h2>
                    <div className="gate-code">{settings.key_safe_code}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {(settings?.gate_code || settings?.key_safe_code) && (
            <p className="security-note">Please do not share these codes with unauthorized persons.</p>
          )}

          {settings?.security_info && (
            <div className="security-card info-card">
              <div className="security-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 10.99h6c-.46 3.37-2.69 6.32-6 7.41V13H6V6.3l6-2.25v8.94z"/>
                </svg>
              </div>
              <div className="security-card-content">
                <h2>Security Information</h2>
                <div className="security-text">
                  {settings.security_info.split('\n').map((line, i) => (
                    <p key={i}>{line || '\u00A0'}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="security-footer">
        <p>If you have any questions about yard security, please contact the yard manager.</p>
      </div>
    </div>
  );
}

export default SecurityInfo;
