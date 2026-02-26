import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type AppHeaderProps = {
  displayName: string;
  email: string;
};

export function AppHeader({ displayName, email }: AppHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRootRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, []);

  return (
    <header className="topbar">
      <div className="brand">
        <img className="logo" src="/images/titech-logo-header.png" alt="WeldDoc" />
      </div>

      <nav className="nav">
        <Link className="navlink" to="/">
          Hjem
        </Link>
        <Link className="navlink" to="/prosjekter">
          Prosjekter
        </Link>
        <Link className="navlink" to="/materialsertifikater">
          Materialsertifikater
        </Link>
        <Link className="navlink" to="/wps">
          Sveiseprosedyrer
        </Link>
        <Link className="navlink" to="/certs">
          Sveisesertifikater
        </Link>
        <Link className="navlink" to="/ndt">
          NDT
        </Link>
      </nav>

      <div className={`user-section${isOpen ? " is-open" : ""}`} data-user-menu ref={menuRootRef}>
        <button
          className="user-avatar"
          id="user-avatar"
          aria-label="Brukerprofil"
          aria-expanded={isOpen ? "true" : "false"}
          aria-haspopup="menu"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
        >
          <div className="avatar-circle">
            <svg viewBox="0 0 24 24" className="avatar-icon" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
              />
            </svg>
          </div>
          <div className="user-name">{displayName}</div>
        </button>

        <div className="user-menu" role="menu" aria-label="Brukermeny">
          {email ? (
            <div className="user-menu__email">
              <svg viewBox="0 0 24 24" className="user-menu__email-icon" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
                />
              </svg>
              <span>{email}</span>
            </div>
          ) : null}
          <Link className="user-menu__item" role="menuitem" to="/settings">
            Innstillinger
          </Link>
          <button className="user-menu__item" role="menuitem" id="logout" type="button">
            Logg ut
          </button>
        </div>
      </div>
    </header>
  );
}
