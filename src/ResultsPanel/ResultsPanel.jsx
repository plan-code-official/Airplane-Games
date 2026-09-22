import './ResultsPanel.css';
import panelFrame from './assets/banal.png';
import celebrationTitle from './assets/good.png';
import coinsImage from './assets/money.png';
import correctImage from './assets/right.png';
import wrongImage from './assets/wrong.png';
import buttonFrame from './assets/boutton.png';

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

/** A portable end-results panel; all game-specific values arrive as props. */
export default function ResultsPanel({
  score,
  totalScore = 100,
  correctAnswers,
  wrongAnswers,
  coins,
  onRetry,
  onBack,
}) {
  const finalScore = numberValue(score);
  const maximumScore = numberValue(totalScore) || 100;
  const correct = numberValue(correctAnswers);
  const wrong = numberValue(wrongAnswers);
  const earnedCoins = numberValue(coins);

  return (
    <div className="results-overlay">
      <section className="results-screen" aria-label="نتائج اللعبة" dir="rtl">
        <div className="results-panel" style={{ '--results-panel-image': `url(${panelFrame})` }}>
          <div className="results-panel__content">
            <img className="results-panel__title" src={celebrationTitle} alt="أحسنت" />
            <div className="results-score-card">
              <span className="results-score-card__label">{'\u0627\u0644\u062f\u0651\u064e\u0631\u064e\u062c\u064e\u0629\u064f'}</span>
              <strong>{finalScore}/{maximumScore}</strong>
            </div>
            <div className="results-stats" aria-label="إحصاءات الأداء">
              <div className="results-stat-card results-stat-card--correct">
                <img src={correctImage} alt="إجابات صحيحة" />
                <strong>{correct}</strong>
              </div>
              <div className="results-stat-card results-stat-card--coins">
                <img src={coinsImage} alt="عملات مكتسبة" />
                <strong>+{earnedCoins}</strong>
                <span>{'\u0641\u0650\u0644\u064f\u0648\u0633'}</span>
              </div>
              <div className="results-stat-card results-stat-card--wrong">
                <img src={wrongImage} alt="إجابات خاطئة" />
                <strong>{wrong}</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="results-actions">
          <button className="results-action results-action--back" type="button" onClick={onBack}>
            <img src={buttonFrame} alt="" aria-hidden="true" />
            <span className="results-action__group">
              <span>{'\u0627\u0631\u0652\u062c\u0650\u0639\u0652'}</span>
              <span className="results-action__exit-icon" aria-hidden="true">⎋</span>
            </span>
          </button>
          <button className="results-action results-action--retry" type="button" onClick={onRetry}>
            <img src={buttonFrame} alt="" aria-hidden="true" />
            <span aria-hidden="true">↻</span>
            <span>{'\u062b\u0627\u0646\u0650\u064a\u064e\u0629\u064b'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
