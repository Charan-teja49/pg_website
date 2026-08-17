import { useEffect, useState } from 'react';
import {
  IndianRupee,
  FileText,
  RefreshCw,
  UserPlus,
  Clock,
} from 'lucide-react';
import { fetchRecentActivity, type ActivityItem } from '../data/activity';
import BuildingTag from './BuildingTag';

const KIND_ICON: Record<
  ActivityItem['kind'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { Icon: any; bg: string; color: string }
> = {
  payment: {
    Icon: IndianRupee,
    bg: 'bg-emerald-50',
    color: 'text-emerald-700',
  },
  complaint: { Icon: FileText, bg: 'bg-red-50', color: 'text-red-700' },
  room_request: {
    Icon: RefreshCw,
    bg: 'bg-amber-50',
    color: 'text-amber-700',
  },
  student: {
    Icon: UserPlus,
    bg: 'bg-[#FBE6DD]',
    color: 'text-[#B85138]',
  },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

export default function ActivityFeed({
  buildingId,
  showBuildingTag = false,
  limit = 8,
}: {
  buildingId: number | null;
  showBuildingTag?: boolean;
  limit?: number;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRecentActivity(buildingId, limit)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId, limit]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800">Recent activity</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
          last {limit}
        </span>
      </div>
      <div className="p-2">
        {loading && (
          <div className="px-3 py-6 text-sm text-gray-500 text-center">
            Loading…
          </div>
        )}
        {error && (
          <div className="px-3 py-4 text-xs text-red-700 bg-red-50 mx-2 my-2 rounded">
            {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="px-3 py-6 text-sm text-gray-500 text-center">
            Nothing to show yet. New activity will appear here.
          </div>
        )}
        {!loading &&
          !error &&
          items.map((item, idx) => {
            const k = KIND_ICON[item.kind];
            const Icon = k.Icon;
            return (
              <div
                key={`${item.kind}-${idx}`}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50"
              >
                <div
                  className={`w-9 h-9 rounded-md grid place-items-center flex-shrink-0 ${k.bg}`}
                >
                  <Icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.title}
                    </p>
                    {showBuildingTag && (
                      <BuildingTag shortName={item.building_short_name} />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {item.subtitle}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0 mt-1">
                  {timeAgo(item.at)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
