interface IconProps {
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function SelectionIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4.5 3.5l15.2 8.6-7.3 1.1-3.1 6.9z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HandIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

export function RectIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  );
}

export function DiamondIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 4l8 8-8 8-8-8z" />
    </svg>
  );
}

export function EllipseIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function LineIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 19L19 5" />
    </svg>
  );
}

export function ArrowIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 19L19 5" />
      <path d="M11 5h8v8" />
    </svg>
  );
}

export function TextIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 7V5h14v2" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function MinusIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function TargetIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function FocusIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function SunIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function MoonIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function MonitorIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function MenuIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function FitIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function UndoIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

export function RedoIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0-6 6v1" />
    </svg>
  );
}

export function LibraryIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <path d="M17.25 13.5v7.5M13.5 17.25h7.5" />
    </svg>
  );
}

export function ImageIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export function ImportIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function ExportIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function GridIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function material(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 -960 960 960",
    fill: "currentColor",
    "aria-hidden": true,
  };
}

export function GridLinesIcon({ size = 16 }: IconProps) {
  return (
    <svg {...material(size)}>
      <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h133v-133H200v133Zm213 0h134v-133H413v133Zm214 0h133v-133H627v133ZM200-413h133v-134H200v134Zm213 0h134v-134H413v134Zm214 0h133v-134H627v134ZM200-627h133v-133H200v133Zm213 0h134v-133H413v133Zm214 0h133v-133H627v133Z" />
    </svg>
  );
}

export function GridDotsIcon({ size = 16 }: IconProps) {
  return (
    <svg {...material(size)}>
      <path d="M300-240q25 0 42.5-17.5T360-300q0-25-17.5-42.5T300-360q-25 0-42.5 17.5T240-300q0 25 17.5 42.5T300-240Zm0-360q25 0 42.5-17.5T360-660q0-25-17.5-42.5T300-720q-25 0-42.5 17.5T240-660q0 25 17.5 42.5T300-600Zm0 180q25 0 42.5-17.5T360-480q0-25-17.5-42.5T300-540q-25 0-42.5 17.5T240-480q0 25 17.5 42.5T300-420Zm360 180q25 0 42.5-17.5T720-300q0-25-17.5-42.5T660-360q-25 0-42.5 17.5T600-300q0 25 17.5 42.5T660-240Zm0-360q25 0 42.5-17.5T720-660q0-25-17.5-42.5T660-720q-25 0-42.5 17.5T600-660q0 25 17.5 42.5T660-600ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Zm460 340q25 0 42.5-17.5T720-480q0-25-17.5-42.5T660-540q-25 0-42.5 17.5T600-480q0 25 17.5 42.5T660-420ZM480-600q25 0 42.5-17.5T540-660q0-25-17.5-42.5T480-720q-25 0-42.5 17.5T420-660q0 25 17.5 42.5T480-600Zm0 360q25 0 42.5-17.5T540-300q0-25-17.5-42.5T480-360q-25 0-42.5 17.5T420-300q0 25 17.5 42.5T480-240Zm0-180q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420Z" />
    </svg>
  );
}

export function GridOffIcon({ size = 16 }: IconProps) {
  return (
    <svg {...material(size)}>
      <path d="M333-200v-133H200v133h133Zm214 0v-100l-33-33H413v133h134Zm80 0Zm116-133Zm-410-80v-101l-33-33H200v134h133Zm80 0Zm347 0v-134H627v99l35 35h98ZM529-547Zm-329-80Zm347 0v-133H413v98l35 35h99Zm213 0v-133H627v133h133ZM316-760Zm524 525L235-840h525q33 0 56.5 23.5T840-760v525ZM200-120q-33 0-56.5-23.5T120-200v-640l720 720H200Zm619 92L28-820l56-56L876-84l-57 56Z" />
    </svg>
  );
}

export function PaletteIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 21a9 9 0 1 1 9-9c0 2.5-2 3-3.5 3H16a2 2 0 0 0-1.5 3.3c.4.5.5 1.2 0 1.7-.5.6-1.4 1-2.5 1z" />
      <circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DropletIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 2.7c3 3.1 5.5 6.2 5.5 9.3a5.5 5.5 0 0 1-11 0c0-3.1 2.5-6.2 5.5-9.3z" />
    </svg>
  );
}

export function KeyboardIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <line x1="6" y1="8" x2="6.01" y2="8" />
      <line x1="10" y1="8" x2="10.01" y2="8" />
      <line x1="14" y1="8" x2="14.01" y2="8" />
      <line x1="18" y1="8" x2="18.01" y2="8" />
      <line x1="6" y1="12" x2="6.01" y2="12" />
      <line x1="10" y1="12" x2="10.01" y2="12" />
      <line x1="14" y1="12" x2="14.01" y2="12" />
      <line x1="18" y1="12" x2="18.01" y2="12" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  );
}

export function OpenIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function SaveIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
