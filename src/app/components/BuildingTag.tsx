/**
 * Small chip that shows a building's short name. Used in cross-building
 * list views ("All buildings" mode) to label each row.
 */
export default function BuildingTag({
  shortName,
  className = '',
}: {
  shortName: string | null;
  className?: string;
}) {
  if (!shortName) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#FBE6DD] text-[#92402C] border border-[#F2C8B5] ${className}`}
    >
      {shortName}
    </span>
  );
}
