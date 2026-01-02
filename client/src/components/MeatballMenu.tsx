import { useState, useRef, useEffect } from 'react';
import './MeatballMenu.css';

interface Action {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface MeatballMenuProps {
  actions: Action[];
}

const MeatballMenu = ({ actions }: MeatballMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row selection
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="meatball-menu-container" ref={menuRef}>
      <button className="meatball-button" onClick={toggleMenu}>
        &#8942;
      </button>
      {isOpen && (
        <div className="meatball-dropdown">
          {actions.map((action, index) => (
            <button
              key={index}
              className={`meatball-item ${action.variant === 'danger' ? 'danger' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
                setIsOpen(false);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MeatballMenu;
