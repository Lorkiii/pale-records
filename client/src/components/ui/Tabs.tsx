// Renders an accessible, horizontally scrollable tablist with automatic keyboard activation.
import React, { useRef, type KeyboardEvent } from 'react';

export interface TabItem {
  id: string;
  tabId: string;
  panelId: string;
  label: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  ariaLabel?: string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className = '',
}) => {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    const enabledTabs = tabs.filter((tab) => !tab.disabled);
    const currentIndex = enabledTabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = enabledTabs.length - 1;
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    }
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % enabledTabs.length;
    }

    event.preventDefault();
    const nextTab = enabledTabs[nextIndex];
    if (!nextTab) return;

    onChange(nextTab.id);
    const nextTabElement = tabRefs.current.get(nextTab.id);
    nextTabElement?.focus({ preventScroll: true });
    nextTabElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={`flex w-full items-center overflow-x-auto overscroll-x-contain border-b border-ink ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) tabRefs.current.set(tab.id, element);
              else tabRefs.current.delete(tab.id);
            }}
            id={tab.tabId}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={tab.panelId}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, tab.id)}
            className={`flex min-h-11 shrink-0 cursor-pointer select-none items-center gap-2 border-r border-ink px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink md:px-5 ${
              isActive
                ? 'bg-ink font-bold text-paper-light'
                : 'bg-transparent text-ink hover:bg-paper-muted active:bg-paper-dark'
            } ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span>{tab.label}</span>
            {tab.badge && <span>{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
};
