import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

export function renderSetupScreen(root: HTMLElement) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <main className="desktop-shell">
        <section className="window setup-window">
          <header className="title-bar">
            <div className="title-wrap">
              <span className="app-glyph">B</span>
              <span>Blackout Messenger</span>
            </div>
            <div className="window-buttons" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </header>
          <div className="setup-content">
            <div className="panel-title">CONFIG REQUIRED</div>
            <p>Fill `.env` before loading the encrypted messenger shell.</p>
            <pre>{`VITE_PRIVY_APP_ID=
VITE_BLACKOUT_CONTRACT_ADDRESS=
VITE_FHENIX_CHAIN=base-sepolia`}</pre>
            <p>Then restart the dev server.</p>
          </div>
        </section>
      </main>
    </React.StrictMode>,
  );
}
