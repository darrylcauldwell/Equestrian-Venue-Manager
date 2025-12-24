import React from 'react';

export interface Tab {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className = '' }: TabsProps) {
  return (
    <div className={`ds-tabs ${className}`.trim()} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`ds-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ds-tab-count">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ id, activeTab, children, className = '' }: TabPanelProps) {
  if (id !== activeTab) return null;

  return (
    <div
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={id}
      className={className}
    >
      {children}
    </div>
  );
}

export default Tabs;
