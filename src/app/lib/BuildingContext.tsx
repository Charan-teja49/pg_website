import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from './supabase';
import type { BuildingCode } from './buildings';

export interface BuildingRow {
  id: number;
  code: BuildingCode;
  name: string;
  short_name: string;
  yearly_fee: number;
  electricity_fee: number;
  non_refundable_fee: number;
  planned_capacity: number;
}

/**
 * `currentId` semantics:
 *   - `null`  = "All buildings" (cross-building aggregate views — super-admin scope)
 *   - number  = a real building id
 *
 * `current` resolves to the BuildingRow when currentId is a real id; otherwise null.
 * `isAllBuildings` is the explicit boolean for the "All" mode.
 */
interface BuildingContextValue {
  buildings: BuildingRow[];
  loading: boolean;
  error: string | null;
  currentId: number | null;
  current: BuildingRow | null;
  isAllBuildings: boolean;
  setCurrent: (id: number | null) => void;
  refresh: () => Promise<void>;
}

const BuildingContext = createContext<BuildingContextValue | null>(null);

const STORAGE_KEY = 'pg.current-building-id';
// Sentinel stored in localStorage to mean "all buildings".
const ALL_SENTINEL = '__all__';

export function BuildingProvider({
  children,
  scope = 'admin',
  forceBuildingId,
  lockedBuildingId,
  allowAllOption = true,
}: {
  children: ReactNode;
  /** 'admin' = user picks + persists. 'student' = locked to forceBuildingId, no switcher. */
  scope?: 'admin' | 'student';
  forceBuildingId?: number | null;
  /**
   * When set (typically for `building_staff` admins), the provider locks
   * to this building, filters `buildings` to just that one, and
   * `setCurrent` becomes a no-op. Overrides `allowAllOption`.
   */
  lockedBuildingId?: number | null;
  /** Set to false to hide the "All buildings" option. */
  allowAllOption?: boolean;
}) {
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(() => {
    if (scope === 'student') return forceBuildingId ?? null;
    if (lockedBuildingId !== undefined && lockedBuildingId !== null) {
      return lockedBuildingId;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return null;
    if (saved === ALL_SENTINEL) return null;
    const n = Number(saved);
    return Number.isFinite(n) ? n : null;
  });

  const fetchBuildings = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('buildings')
        .select(
          'id, code, name, short_name, yearly_fee, electricity_fee, non_refundable_fee, planned_capacity',
        )
        .order('id');
      if (e) throw e;
      let rows = (data ?? []) as BuildingRow[];
      // Building-staff admins only see their assigned building.
      if (lockedBuildingId !== undefined && lockedBuildingId !== null) {
        rows = rows.filter((b) => b.id === lockedBuildingId);
      }
      setBuildings(rows);

      // First-load selection rules:
      //  - admin + all-option enabled  → start in "All buildings"
      //  - admin + single only         → first building
      //  - student                     → forceBuildingId stays
      if (scope === 'admin' && currentId === null && localStorage.getItem(STORAGE_KEY) === null) {
        if (allowAllOption) {
          setCurrentId(null);
          localStorage.setItem(STORAGE_KEY, ALL_SENTINEL);
        } else if (rows.length > 0) {
          setCurrentId(rows[0].id);
          localStorage.setItem(STORAGE_KEY, String(rows[0].id));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrent = (id: number | null) => {
    if (scope !== 'admin') return;
    if (lockedBuildingId !== undefined && lockedBuildingId !== null) return;
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, id === null ? ALL_SENTINEL : String(id));
  };

  const current = buildings.find((b) => b.id === currentId) ?? null;
  const isAllBuildings = currentId === null;

  return (
    <BuildingContext.Provider
      value={{
        buildings,
        loading,
        error,
        currentId,
        current,
        isAllBuildings,
        setCurrent,
        refresh: fetchBuildings,
      }}
    >
      {children}
    </BuildingContext.Provider>
  );
}

export function useBuilding() {
  const ctx = useContext(BuildingContext);
  if (!ctx) throw new Error('useBuilding must be used inside a BuildingProvider');
  return ctx;
}
