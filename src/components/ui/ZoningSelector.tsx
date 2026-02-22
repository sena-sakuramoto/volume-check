'use client';

import type { ZoningDistrict, ZoningData } from '@/engine/types';
import { getZoningDefaults } from '@/engine';

interface ZoningSelectorProps {
  selectedDistrict: ZoningDistrict | null;
  onSelect: (district: ZoningDistrict) => void;
}

interface DistrictGroup {
  label: string;
  bgClass: string;
  activeBgClass: string;
  districts: ZoningDistrict[];
}

const DISTRICT_GROUPS: DistrictGroup[] = [
  {
    label: '住居系',
    bgClass: 'bg-blue-900/30 text-blue-200 hover:bg-blue-800/50',
    activeBgClass: 'bg-blue-600 text-white',
    districts: [
      '第一種低層住居専用地域',
      '第二種低層住居専用地域',
      '第一種中高層住居専用地域',
      '第二種中高層住居専用地域',
      '第一種住居地域',
      '第二種住居地域',
      '準住居地域',
      '田園住居地域',
    ],
  },
  {
    label: '商業系',
    bgClass: 'bg-orange-900/30 text-orange-200 hover:bg-orange-800/50',
    activeBgClass: 'bg-orange-600 text-white',
    districts: ['近隣商業地域', '商業地域'],
  },
  {
    label: '工業系',
    bgClass: 'bg-gray-700/50 text-gray-200 hover:bg-gray-600/50',
    activeBgClass: 'bg-gray-500 text-white',
    districts: ['準工業地域', '工業地域', '工業専用地域'],
  },
];

/** Shorten district names for display in compact buttons */
function shortenDistrict(d: ZoningDistrict): string {
  return d
    .replace('専用地域', '専用')
    .replace('地域', '');
}

export function ZoningSelector({ selectedDistrict, onSelect }: ZoningSelectorProps) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        用途地域を選択
      </h3>
      {DISTRICT_GROUPS.map((group) => (
        <div key={group.label}>
          <span className="block text-xs text-gray-500 mb-1">{group.label}</span>
          <div className="grid grid-cols-2 gap-1">
            {group.districts.map((district) => {
              const isActive = selectedDistrict === district;
              return (
                <button
                  key={district}
                  onClick={() => onSelect(district)}
                  title={district}
                  className={`rounded px-2 py-1.5 text-xs font-medium transition-colors truncate ${
                    isActive ? group.activeBgClass : group.bgClass
                  }`}
                >
                  {shortenDistrict(district)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
