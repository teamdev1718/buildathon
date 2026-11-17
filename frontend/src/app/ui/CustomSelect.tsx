import React, { useState, useRef, useEffect } from 'react';
import { IconCheck } from './Icons';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string | number;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  options: SelectOption[] | string[];
  onChange: (value: string) => void;
  variant?: 'mini' | 'input';
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  block?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  value,
  options,
  onChange,
  variant = 'mini',
  placeholder,
  className = '',
  ariaLabel,
  style,
  block = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder || value;

  // Close when clicking outside
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

  // Close on Escape key
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

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const isMini = variant === 'mini';

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrap ${className}`}
      style={{
        position: 'relative',
        display: block ? 'block' : 'inline-block',
        width: block ? '100%' : undefined,
        ...style
      }}
    >
      <button
        id={id}
        type="button"
        className={`custom-select-trigger ${isMini ? 'mini-style' : 'input-style'} ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || displayLabel}
        style={{
          width: block ? '100%' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: '#ffffff',
          border: '1.5px solid var(--line)',
          borderRadius: isMini ? 999 : 14,
          padding: isMini ? '0 18px' : '11px 16px',
          minHeight: isMini ? 48 : 50,
          fontSize: isMini ? 13.5 : 15,
          fontWeight: isMini ? 600 : 500,
          color: 'var(--ink2)',
          textAlign: 'left',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(42, 143, 114, 0.15)' : 'none',
          borderColor: isOpen ? 'var(--mid)' : 'var(--line)'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel}
        </span>
        <svg
          viewBox="0 0 12 8"
          fill="none"
          style={{
            width: 11,
            height: 7,
            stroke: 'var(--green)',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            flexShrink: 0
          }}
          aria-hidden="true"
        >
          <path d="M1 1.5l5 5 5-5" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="custom-select-popover"
          role="listbox"
          aria-label={ariaLabel || 'Options'}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: '100%',
            width: block ? '100%' : 'max-content',
            maxWidth: block ? '100%' : 340,
            background: '#ffffff',
            border: '1.5px solid var(--line)',
            borderRadius: 18,
            boxShadow: '0 14px 36px rgba(11, 42, 34, 0.14)',
            padding: 6,
            zIndex: 100,
            animation: 'dropdownIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? 'var(--green)' : 'var(--ink2)',
                  background: isSelected ? 'var(--bg)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.12s ease, color 0.12s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'var(--bg2)';
                    e.currentTarget.style.color = 'var(--green-deep)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--ink2)';
                  }
                }}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <IconCheck className="w-4 h-4 stroke-[#0e5c48]" />
                  </span>
                )}
                {opt.badge && !isSelected && (
                  <span className="badge-pill" style={{ fontSize: 11 }}>{opt.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
