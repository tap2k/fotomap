import { FaGithub } from 'react-icons/fa';

export default function LandingFooter() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '24px 16px 16px',
      marginTop: '8px',
      borderTop: '1px solid #e9ecef',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', columnGap: '20px', rowGap: '6px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
        <a
          href="https://github.com/tap2k/fotomap"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <FaGithub size={16} /> Frontend
        </a>
        <a
          href="https://github.com/tap2k/fotomap-backend"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <FaGithub size={16} /> Backend
        </a>
        <div style={{ flexBasis: '100%', height: 0 }} className="d-block d-md-none" />
        <a href="https://blog.represent.org" target="_blank" rel="noopener noreferrer" style={{ color: '#999', textDecoration: 'none' }}>Blog</a>
        <a href="/privacy" style={{ color: '#999', textDecoration: 'none' }}>Privacy</a>
        <a href="/terms" style={{ color: '#999', textDecoration: 'none' }}>Terms</a>
        <a href="mailto:fotomap@represent.org" style={{ color: '#999', textDecoration: 'none' }}>Contact</a>
      </div>
    </div>
  );
}
