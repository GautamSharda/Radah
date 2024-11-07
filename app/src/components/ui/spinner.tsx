import React from 'react';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'medium', className }) => {
  const sizeClasses = {
    small: 'w-4 h-4 border-4',
    medium: 'w-8 h-8 border-4',
    large: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex justify-center items-center`}>
      <div
        className={`border-4 border-slate-900 border-t-4 border-t-white rounded-full animate-spin ${sizeClasses[size]} ${className}`}
      />
    </div>
  );
};

export default Spinner;
