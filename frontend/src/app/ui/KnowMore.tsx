import React, { useState, useRef, useEffect } from 'react';
import { IconX } from './Icons';

interface KnowMoreProps {
  title: string;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  align?: 'left' | 'right';
}

export const KnowMore: React.FC<KnowMoreProps> = ({
  title,
  children,
  ariaLabel = 'Know more',
  className = '',
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`know-more-wrap ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 1
      }}
    >
      <button
        type="button"
        className="know-more-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        title={ariaLabel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          minWidth: 22,
          maxWidth: 22,
          minHeight: 22,
          maxHeight: 22,
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          border: 'none',
          background: isOpen ? 'rgba(14, 92, 72, 0.12)' : 'transparent',
          color: isOpen ? 'var(--green-deep)' : 'var(--green)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          padding: 0,
          margin: 0,
          boxSizing: 'border-box',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(14, 92, 72, 0.1)';
          e.currentTarget.style.color = 'var(--green-deep)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--green)';
          }
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 20, height: 20, flexShrink: 0, display: 'block' }}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.75" />
          <line x1="12" y1="16" x2="12" y2="11.5" />
          <circle cx="12" cy="7.5" r="0.75" fill="currentColor" strokeWidth="0.8" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="know-more-popover"
          role="dialog"
          aria-label={title}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            [align === 'right' ? 'right' : 'left']: 0,
            width: 285,
            maxWidth: 'calc(100vw - 32px)',
            background: '#ffffff',
            border: '1.5px solid var(--line)',
            borderRadius: 16,
            boxShadow: '0 14px 34px rgba(11, 42, 34, 0.16)',
            padding: '14px 16px',
            zIndex: 120,
            animation: 'dropdownIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px solid var(--line)'
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--green-deep)'
              }}
            >
              {title}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close notice"
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: 'var(--muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ink2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted)';
              }}
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--ink2)'
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
