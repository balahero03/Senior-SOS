import React from 'react';

export default function PageHeading({ eyebrow, title, description, actions, className = '' }) {
  return (
    <header className={`page-heading ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="page-heading-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-heading-description">{description}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
