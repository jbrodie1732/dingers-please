import AdminPanel from '@/components/AdminPanel';

export default function AdminPage() {
  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">COMMISSIONER TOOLS</div>
        <h1 className="hero-title">Admin</h1>
        <div className="hero-meta">
          <span>Add/drop · Manual HR · Season config · Danger zone</span>
        </div>
      </div>

      <AdminPanel />
    </div>
  );
}
