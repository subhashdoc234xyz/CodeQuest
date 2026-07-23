import React, { useState } from 'react';
import { uploadAndGetShareLink } from '../services/shareService';
import { Share, Copy, Check, Loader2 } from 'lucide-react';

export default function ShareButton({
  getBlobFn,
  folder = "shares",
  filename = "export.pdf",
  label = "Share Link",
  className = ""
}) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleShare = async () => {
    setLoading(true);
    setErrorMsg('');
    setShareUrl(null);
    setCopied(false);

    try {
      const blob = await getBlobFn();
      if (!blob || blob.size === 0) {
        throw new Error("File output is empty. Cannot share.");
      }

      const url = await uploadAndGetShareLink(blob, folder, filename);
      setShareUrl(url);

      // Copy to clipboard
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("[Share] Error during upload:", err);
      if (err.code === "storage/unauthorized") {
        setErrorMsg("Permission denied. Check storage rules.");
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAgain = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }} className={className}>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleShare}
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 16px' }}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={14} />
            Uploading...
          </>
        ) : (
          <>
            <Share size={14} />
            {label}
          </>
        )}
      </button>

      {errorMsg && (
        <div style={{ color: '#FF5A5F', fontSize: '0.75rem', marginTop: '4px' }}>
          {errorMsg}
        </div>
      )}

      {shareUrl && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '8px', 
          background: '#F3F5F9', 
          border: '1px solid #DDE2EB',
          padding: '6px 10px', 
          borderRadius: '6px', 
          fontSize: '0.8rem',
          color: '#0B1D3A' 
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {shareUrl}
          </span>
          <button
            type="button"
            onClick={handleCopyAgain}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#3E6BD6', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600
            }}
          >
            {copied ? <Check size={14} color="#3EBE7A" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
