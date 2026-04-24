import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function SvgIcon({ children, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h12" />
      <path d="M4 17h16" />
    </SvgIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </SvgIcon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M15 17H9" />
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" />
      <path d="M10 20h4" />
    </SvgIcon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </SvgIcon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M21 14.8A8.5 8.5 0 0 1 9.2 3 7 7 0 1 0 21 14.8Z" />
    </SvgIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </SvgIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </SvgIcon>
  );
}

export function NavIcon({ name, ...props }: { name: string } & IconProps) {
  switch (name) {
    case "home":
      return (
        <SvgIcon {...props}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10.5V20h14v-9.5" />
          <path d="M10 20v-5h4v5" />
        </SvgIcon>
      );
    case "setup":
      return (
        <SvgIcon {...props}>
          <path d="M12 3v4" />
          <path d="M12 17v4" />
          <path d="M4.9 4.9 7.7 7.7" />
          <path d="m16.3 16.3 2.8 2.8" />
          <path d="M3 12h4" />
          <path d="M17 12h4" />
          <path d="m4.9 19.1 2.8-2.8" />
          <path d="m16.3 7.7 2.8-2.8" />
        </SvgIcon>
      );
    case "governance":
      return (
        <SvgIcon {...props}>
          <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </SvgIcon>
      );
    case "operations":
      return (
        <SvgIcon {...props}>
          <path d="M4 19V5" />
          <path d="M20 19V5" />
          <path d="M8 17v-6" />
          <path d="M12 17V7" />
          <path d="M16 17v-3" />
        </SvgIcon>
      );
    case "work":
      return (
        <SvgIcon {...props}>
          <path d="M4 7h16v13H4z" />
          <path d="M8 7V5h8v2" />
          <path d="M4 12h16" />
        </SvgIcon>
      );
    case "settings":
      return (
        <SvgIcon {...props}>
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2 .1 7 7 0 0 1-1.7 1l-.2.1a1.7 1.7 0 0 0-1.4 1.5H8.4a1.7 1.7 0 0 0-1.3-1.5l-.3-.1a7 7 0 0 1-1.7-1 1.8 1.8 0 0 0-2-.1l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 1.4 15a7 7 0 0 1 0-2 1.7 1.7 0 0 0-.3-1.9L1 11l2-3.4.2.1a1.8 1.8 0 0 0 2-.1 7 7 0 0 1 1.7-1l.3-.1A1.7 1.7 0 0 0 8.4 5h3.9a1.7 1.7 0 0 0 1.4 1.5l.2.1a7 7 0 0 1 1.7 1 1.8 1.8 0 0 0 2 .1l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 7 7 0 0 1 0 2Z" />
        </SvgIcon>
      );
    default:
      return (
        <SvgIcon {...props}>
          <path d="M4 5h16" />
          <path d="M4 12h16" />
          <path d="M4 19h16" />
        </SvgIcon>
      );
  }
}
