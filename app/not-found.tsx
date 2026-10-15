import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="loading" style={{ minHeight: '100vh', textAlign: 'center' }}>
      <div><h1 style={{ fontFamily: 'var(--display)' }}>Page not found</h1><Link className="btn" href="/">Back to home</Link></div>
    </div>
  );
}
