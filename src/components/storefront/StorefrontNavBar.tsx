import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import type { NavItem } from "@/types/siteBuilderV2";

interface StorefrontNavBarProps {
  orgName: string;
  logoUrl?: string | null;
  navigation: NavItem[];
  primaryColor?: string;
}

export function StorefrontNavBar({ orgName, logoUrl, navigation, primaryColor }: StorefrontNavBarProps) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  if (!navigation || navigation.length === 0) return null;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur border-b"
      style={{
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'var(--sf-primary, #3B82F6)',
        borderBottomWidth: 2,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Org name */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} className="h-10 w-auto object-contain" />
            ) : (
              <span className="text-xl font-bold" style={{ color: 'var(--sf-primary, #1E293B)' }}>
                {orgName}
              </span>
            )}
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t bg-white">
          <div className="px-4 py-3 space-y-1">
            {navigation.map((item) => (
              <MobileNavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const isAnchor = item.type === 'anchor' || item.href.startsWith('#');
  const isExternal = item.type === 'external';

  const className = `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'text-white'
      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
  }`;

  const activeStyle = active
    ? { backgroundColor: 'var(--sf-primary, #3B82F6)' }
    : undefined;

  if (isAnchor || isExternal) {
    return (
      <a href={item.href} className={className} style={activeStyle}
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link to={item.href} className={className} style={activeStyle}>
      {item.label}
    </Link>
  );
}

function MobileNavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const isAnchor = item.type === 'anchor' || item.href.startsWith('#');
  const isExternal = item.type === 'external';

  const className = `block w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-colors ${
    active
      ? 'text-white'
      : 'text-gray-700 hover:bg-gray-50'
  }`;

  const activeStyle = active
    ? { backgroundColor: 'var(--sf-primary, #3B82F6)' }
    : undefined;

  if (isAnchor || isExternal) {
    return (
      <a href={item.href} className={className} style={activeStyle} onClick={onClick}
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link to={item.href} className={className} style={activeStyle} onClick={onClick}>
      {item.label}
    </Link>
  );
}
