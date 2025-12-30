import { useState, useEffect } from 'react';
import { contractsApi } from '../services/api';
import { Modal } from '../components/ui';
import type { MyContract, SignatureStatus } from '../types';
import '../styles/MyContracts.css';

const statusLabels: Record<SignatureStatus, string> = {
  pending: 'Pending Signature',
  sent: 'Ready to Sign',
  signed: 'Signed',
  declined: 'Declined',
  voided: 'Voided',
};

const statusColors: Record<SignatureStatus, string> = {
  pending: 'status-pending',
  sent: 'status-sent',
  signed: 'status-signed',
  declined: 'status-declined',
  voided: 'status-voided',
};

export default function MyContracts() {
  const [contracts, setContracts] = useState<MyContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingContract, setViewingContract] = useState<MyContract | null>(null);
  const [contractContent, setContractContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [signingContract, setSigningContract] = useState<MyContract | null>(null);
  const [isInitiatingSigning, setIsInitiatingSigning] = useState(false);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const data = await contractsApi.getMyContracts();
      setContracts(data);
      setError('');
    } catch (err) {
      setError('Failed to load contracts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContract = async (contract: MyContract) => {
    try {
      setLoadingContent(true);
      setViewingContract(contract);
      const content = await contractsApi.getMyContractContent(contract.signature_id);
      setContractContent(content.html_content);
    } catch (err) {
      setError('Failed to load contract content');
      console.error(err);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleInitiateSigning = async (contract: MyContract) => {
    try {
      setIsInitiatingSigning(true);
      setSigningContract(contract);
      const result = await contractsApi.initiateSigning(contract.signature_id);

      if (result.redirect_url) {
        // Redirect to DocuSign for signing
        window.location.href = result.redirect_url;
      } else if (result.envelope_id) {
        // In test mode, simulate completion
        setError('');
        await handleCompleteSigning(contract.signature_id, result.envelope_id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initiate signing';
      setError(message);
    } finally {
      setIsInitiatingSigning(false);
      setSigningContract(null);
    }
  };

  const handleCompleteSigning = async (signatureId: number, envelopeId: string) => {
    try {
      await contractsApi.completeSigning(signatureId, { event: 'signing_complete', envelope_id: envelopeId });
      // Reload contracts to show updated status
      await loadContracts();
    } catch (err) {
      console.error('Failed to complete signing:', err);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const pendingContracts = contracts.filter(
    (c) => c.status === 'pending' || c.status === 'sent'
  );
  const signedContracts = contracts.filter((c) => c.status === 'signed');
  const otherContracts = contracts.filter(
    (c) => c.status === 'declined' || c.status === 'voided'
  );

  if (loading) {
    return (
      <div className="my-contracts-page">
        <div className="ds-loading">Loading contracts...</div>
      </div>
    );
  }

  return (
    <div className="my-contracts-page">
      <header className="page-header">
        <h1>My Contracts</h1>
        <p className="subtitle">View and sign your contracts</p>
      </header>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Pending Contracts Section */}
      {pendingContracts.length > 0 && (
        <section className="contracts-section">
          <h2>Action Required</h2>
          <p className="section-description">
            These contracts require your signature
          </p>
          <div className="contracts-grid">
            {pendingContracts.map((contract) => (
              <div key={contract.signature_id} className="contract-card pending">
                <div className="contract-header">
                  <h3>{contract.template_name}</h3>
                  <span className={`contract-status ${statusColors[contract.status]}`}>
                    {statusLabels[contract.status]}
                  </span>
                </div>
                <div className="contract-meta">
                  <span className="contract-type">{contract.contract_type}</span>
                  <span className="contract-version">v{contract.version_number}</span>
                </div>
                {contract.notes && (
                  <p className="contract-notes">{contract.notes}</p>
                )}
                <div className="contract-dates">
                  <span>Requested: {formatDate(contract.requested_at)}</span>
                </div>
                <div className="contract-actions">
                  <button
                    className="ds-btn ds-btn-secondary"
                    onClick={() => handleViewContract(contract)}
                  >
                    View Contract
                  </button>
                  <button
                    className="ds-btn ds-btn-primary"
                    onClick={() => handleInitiateSigning(contract)}
                    disabled={isInitiatingSigning && signingContract?.signature_id === contract.signature_id}
                  >
                    {isInitiatingSigning && signingContract?.signature_id === contract.signature_id
                      ? 'Starting...'
                      : 'Sign Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Signed Contracts Section */}
      {signedContracts.length > 0 && (
        <section className="contracts-section">
          <h2>Signed Contracts</h2>
          <div className="contracts-grid">
            {signedContracts.map((contract) => (
              <div key={contract.signature_id} className="contract-card signed">
                <div className="contract-header">
                  <h3>{contract.template_name}</h3>
                  <span className={`contract-status ${statusColors[contract.status]}`}>
                    {statusLabels[contract.status]}
                  </span>
                </div>
                <div className="contract-meta">
                  <span className="contract-type">{contract.contract_type}</span>
                  <span className="contract-version">v{contract.version_number}</span>
                </div>
                <div className="contract-dates">
                  <span>Signed: {formatDate(contract.signed_at)}</span>
                </div>
                <div className="contract-actions">
                  <button
                    className="ds-btn ds-btn-secondary"
                    onClick={() => handleViewContract(contract)}
                  >
                    View Contract
                  </button>
                  {contract.signed_pdf_filename && (
                    <a
                      href={`/api/uploads/${contract.signed_pdf_filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ds-btn ds-btn-secondary"
                    >
                      Download Signed PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Other Contracts Section */}
      {otherContracts.length > 0 && (
        <section className="contracts-section">
          <h2>Other Contracts</h2>
          <div className="contracts-grid">
            {otherContracts.map((contract) => (
              <div key={contract.signature_id} className="contract-card other">
                <div className="contract-header">
                  <h3>{contract.template_name}</h3>
                  <span className={`contract-status ${statusColors[contract.status]}`}>
                    {statusLabels[contract.status]}
                  </span>
                </div>
                <div className="contract-meta">
                  <span className="contract-type">{contract.contract_type}</span>
                  <span className="contract-version">v{contract.version_number}</span>
                </div>
                <div className="contract-dates">
                  <span>Requested: {formatDate(contract.requested_at)}</span>
                </div>
                <div className="contract-actions">
                  <button
                    className="ds-btn ds-btn-secondary"
                    onClick={() => handleViewContract(contract)}
                  >
                    View Contract
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {contracts.length === 0 && (
        <div className="ds-empty">
          <p>You don't have any contracts yet.</p>
        </div>
      )}

      {/* View Contract Modal */}
      <Modal
        isOpen={!!viewingContract}
        onClose={() => {
          setViewingContract(null);
          setContractContent('');
        }}
        title={viewingContract?.template_name || 'Contract'}
        size="xl"
        footer={
          <>
            <button
              className="ds-btn ds-btn-secondary"
              onClick={() => {
                setViewingContract(null);
                setContractContent('');
              }}
            >
              Close
            </button>
            {viewingContract && (viewingContract.status === 'pending' || viewingContract.status === 'sent') && (
              <button
                className="ds-btn ds-btn-primary"
                onClick={() => {
                  setViewingContract(null);
                  handleInitiateSigning(viewingContract);
                }}
              >
                Sign Now
              </button>
            )}
          </>
        }
      >
        {loadingContent ? (
          <div className="ds-loading">Loading contract...</div>
        ) : (
          <div
            className="contract-content"
            dangerouslySetInnerHTML={{ __html: contractContent }}
          />
        )}
      </Modal>
    </div>
  );
}
