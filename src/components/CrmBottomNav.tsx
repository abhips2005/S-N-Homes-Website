import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Users, Building2, Home } from 'lucide-react';

export default function CrmBottomNav() {
  const location = useLocation();

  const tabs = [
    { to: '/admin/crm', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/admin/crm/inbox', label: 'Inbox', icon: MessageSquare },
    { to: '/admin/crm/buyers', label: 'Buyers', icon: Users },
    { to: '/admin/crm/sellers', label: 'Sellers', icon: Building2 },
    { to: '/admin/crm/properties', label: 'Listings', icon: Home },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 safe-bottom shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 px-1 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? location.pathname === tab.to
            : location.pathname.startsWith(tab.to);
          const Icon = tab.icon;

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-emerald-600 font-semibold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-transform ${isActive ? 'scale-105 bg-emerald-50' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="mt-0.5 tracking-tight">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
