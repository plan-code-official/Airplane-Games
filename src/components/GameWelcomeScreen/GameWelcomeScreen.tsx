import React from 'react';
import './GameWelcomeScreen.css';

interface GameWelcomeScreenProps {
  backgroundImage?: string;
  statsBgImage: string;
  statLeftIcon?: string;
  statLeftAlt?: string;
  statLeftValue?: string | number;
  statRightValue?: string | number;
  statRightIcon?: string;
  statRightAlt?: string;
  heroImage: string;
  heroAlt?: string;
  startButtonImage: string;
  exitButtonImage: string;
  onStart: () => void;
  onExit?: () => void;
  isLoading?: boolean;
  isReady?: boolean;
}

export default function GameWelcomeScreen({
  backgroundImage,
  statsBgImage,
  statLeftIcon,
  statLeftAlt = 'Stat',
  statLeftValue,
  statRightValue,
  statRightIcon,
  statRightAlt = 'Points',
  heroImage,
  heroAlt = 'How to Play',
  startButtonImage,
  exitButtonImage,
  onStart,
  onExit,
  isLoading = false,
  isReady = true,
}: GameWelcomeScreenProps) {
  const handleExit = onExit || (() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  });

  const startDisabled = isLoading || !isReady;

  return (
    <div
      className="gws-screen"
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {}}
    >

      {/* HEADER: Stats Badge */}
      <header className="gws-header">
        <div
          className="gws-stats-bg"
          style={{ backgroundImage: `url(${statsBgImage})` }}
        >
          {statLeftIcon && <img src={statLeftIcon} alt={statLeftAlt} className="gws-stat-icon" />}
          {statLeftValue !== undefined && <span className="gws-stat-text">{statLeftValue}</span>}
          {statRightValue !== undefined && (
            <>
              <span className="gws-stat-text">=</span>
              <span className="gws-stat-text gws-stat-text--yellow">{statRightValue}</span>
            </>
          )}
          {statRightIcon && <img src={statRightIcon} alt={statRightAlt} className="gws-stat-icon" />}
        </div>
      </header>

      {/* BODY: Hero / Description Image */}
      <main className="gws-body">
        <img
          src={heroImage}
          alt={heroAlt}
          className="gws-hero-img"
        />
      </main>

      {/* FOOTER: Exit + Start Buttons */}
      <footer className="gws-footer">
        <div className="gws-footer-buttons">

          {/* Exit button */}
          <button className="gws-img-btn" onClick={handleExit} aria-label="خروج">
            <img src={exitButtonImage} alt="Exit" />
          </button>

          {/* Start button */}
          <button
            className="gws-start-btn"
            style={{ backgroundImage: `url(${startButtonImage})` }}
            onClick={onStart}
            disabled={startDisabled}
            aria-label={isLoading ? 'جارٍ التحميل' : 'ابدأ اللعبة'}
          />

        </div>
      </footer>

    </div>
  );
}
