import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Building,
  IndianRupee,
  FileText,
  Bell,
  UtensilsCrossed,
  RefreshCw,
  Wrench,
  BarChart,
  Settings,
  LogOut,
  Menu,
  X,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { getCurrentUser, getSession, logout, type AppUser } from '../lib/auth';
import { BuildingProvider } from '../lib/BuildingContext';
import BuildingSwitcher from '../components/BuildingSwitcher';
import ChangePasswordModal from '../components/ChangePasswordModal';

interface NavItem {
  path: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: ComponentType<any>;
  /** Roles allowed to see this item; default = both. */
  roles?: Array<'super' | 'building_staff'>;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/students', label: 'Students', icon: Users },
  { path: '/admin/rooms', label: 'Rooms', icon: Building },
  { path: '/admin/payments', label: 'Payments', icon: IndianRupee },
  { path: '/admin/complaints', label: 'Complaints', icon: FileText },
  { path: '/admin/announcements', label: 'Announcements', icon: Bell },
  { path: '/admin/food-menu', label: 'Food Menu', icon: UtensilsCrossed },
  { path: '/admin/room-requests', label: 'Room Requests', icon: RefreshCw },
  { path: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
  { path: '/admin/visitors', label: 'Visitors', icon: UserCheck },
  { path: '/admin/analytics', label: 'Analytics', icon: BarChart },
  // Super-admin only:
  { path: '/admin/staff', label: 'Staff & Access', icon: ShieldCheck, roles: ['super'] },
  { path: '/admin/settings', label: 'Settings', icon: Settings, roles: ['super'] },
];

function AdminLayoutInner({ user }: { user: AppUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mustChangePwd, setMustChangePwd] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      setMustChangePwd(s?.user?.user_metadata?.must_change_password === true);
    })();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role as 'super' | 'building_staff'),
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-gray-200 relative">
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-[#B85138] grid place-items-center text-white text-[11px] font-bold tracking-tight">
              PG
            </div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-semibold">
              Hostel Management
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Admin Portal</h1>
          <p className="text-sm text-gray-600 mt-1">{user.name ?? 'Warden'}</p>
          <div className="mt-3">
            <BuildingSwitcher />
          </div>
          {user.role === 'super' && (
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-2">
              Super Admin · all buildings
            </p>
          )}
          {user.role === 'building_staff' && (
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-2">
              Building Staff
            </p>
          )}
        </div>
        <nav className="p-4 overflow-y-auto flex-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                  isActive
                    ? 'bg-[#FBE6DD] text-[#B85138] font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full mt-4"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-gray-100 text-gray-700"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#B85138] grid place-items-center text-white text-[10px] font-bold tracking-tight">
              PG
            </div>
            <span className="text-sm font-semibold text-gray-800">Admin</span>
          </div>
          <div className="w-9" />
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      {mustChangePwd && (
        <ChangePasswordModal
          mandatory
          onDone={() => setMustChangePwd(false)}
        />
      )}
    </div>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const u = await getCurrentUser();
        if (!active) return;
        if (!u || (u.role !== 'super' && u.role !== 'building_staff')) {
          navigate('/admin/login');
          return;
        }
        setUser(u);
      } catch {
        navigate('/admin/login');
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (checking || !user) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading…
      </div>
    );
  }

  // Building-staff is locked to their assigned building.
  const lockedBuildingId =
    user.role === 'building_staff' ? user.buildingId ?? null : null;

  return (
    <BuildingProvider scope="admin" lockedBuildingId={lockedBuildingId}>
      <AdminLayoutInner user={user} />
    </BuildingProvider>
  );
}
