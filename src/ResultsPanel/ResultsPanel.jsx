import { useState } from 'react';
import './ResultsPanel.css';
// Exported from Figma: the WHOLE panel (frame, grade pill + its "الدرجة" label,
// the three cards, check / coins / X icons, the "فلوس" label) with the dynamic
// text layers hidden: the title and the four values.
import panelArt from '../assets/results-panel-empty.png';
import celebrationTitle from './assets/good.png';
import exitButtonImage from '../assets/Exit1.png';
import retryButtonImage from '../assets/Retry.png';

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

/**
 * Results panel = one baked image + live text on top.
 * Every overlay is positioned as a % of the image box, so it stays glued to
 * the artwork at any screen size.
 *
 * Optional `debugOverlay`: pass the full Figma export (with numbers) to see it
 * at 50% opacity over the live render while you calibrate positions.
 */
export default function ResultsPanel({
  totalScore = 100,
  correctAnswers,
  wrongAnswers,
  coins,
  totalQuestions,
  onRetry,
  onBack,
  debugOverlay,
}) {
  const correct = numberValue(correctAnswers);
  const wrong = numberValue(wrongAnswers);
  const earnedCoins = numberValue(coins);
  const questionCount = numberValue(totalQuestions) || correct + wrong;
  const correctPercent = questionCount ? Math.round((correct / questionCount) * 100) : 0;
  const isSuccess = questionCount > 0 && correctPercent >= 50;

  // The layout is sized from the exported image's real width / height.
  const [ratio, setRatio] = useState(null);

  return (
    <div className="results-overlay">
      <section
        className="results-screen"
        aria-label="نتائج اللعبة"
        dir="rtl"
        style={ratio ? { '--rp-ratio': ratio } : undefined}
      >
        <div className="results-panel">
          <img
            className="results-panel__art"
            src={panelArt}
            alt=""
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth && naturalHeight) setRatio(naturalWidth / naturalHeight);
            }}
          />

          {isSuccess ? (
            <img className="results-title" src={celebrationTitle} alt="أحسنت" />
          ) : (
            <div className="results-title results-title--fail">حاول مرة أخرى!</div>
          )}

          {/* Visual numbers are hidden from screen readers; one summary replaces them. */}
          <strong className="results-num results-num--grade" aria-hidden="true">{correctPercent}/100</strong>
          <strong className="results-num results-num--correct" aria-hidden="true">{correct}</strong>
          <strong className="results-num results-num--coins" aria-hidden="true">+{earnedCoins}</strong>
          <strong className="results-num results-num--wrong" aria-hidden="true">{wrong}</strong>
          <p className="results-sr">
            {`الدرجة ${correctPercent} من 100. إجابات صحيحة ${correct}. إجابات خاطئة ${wrong}. فلوس مكتسبة ${earnedCoins}.`}
          </p>

          {debugOverlay && <img className="results-debug" src={debugOverlay} alt="" aria-hidden="true" />}
        </div>

        <div className="results-actions">
          <button className="results-action results-action--back" type="button" onClick={onBack}>
            <img className="results-action__bg" src={exitButtonImage} alt="خروج" />
          </button>
          <button className="results-action results-action--retry" type="button" onClick={onRetry}>
            <img className="results-action__bg" src={retryButtonImage} alt="إعادة المحاولة" />
          </button>
        </div>
      </section>
    </div>
  );
}