import DukanchiLogo from './DukanchiLogo';
import NotificationBell from './NotificationBell';

export default function AppHeader() {
  return (
    <div
      className="px-4 py-3 flex justify-between items-center"
      style={{ background: 'var(--dk-bg)' }}
    >
      <div className="flex items-center gap-2.5">
        <DukanchiLogo />
        <div className="flex flex-col" style={{ gap: 1 }}>
          <span
            style={{
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: '-0.3px',
              color: 'var(--dk-text-primary)',
              lineHeight: '1.2',
            }}
          >
            Dukanchi
          </span>
          <span style={{ fontSize: 10, color: '#888', lineHeight: '1.2' }}>
            apna bazaar, apni dukaan
          </span>
        </div>
      </div>
      <NotificationBell />
    </div>
  );
}
