import './ResultsPanel.css';
import panelFrame from './assets/banal.png';
import celebrationTitle from './assets/good.png';
import coinsImage from './assets/money.png';
import correctImage from './assets/right.png';
import wrongImage from './assets/wrong.png';
import exitButtonImage from '../assets/Exit.png';
import retryButtonImage from '../assets/Retry.png';

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
  totalQuestions,
  onRetry,
  onBack,
}) {
  const correct = numberValue(correctAnswers);
  const wrong = numberValue(wrongAnswers);
  const earnedCoins = numberValue(coins);
  const questionCount = numberValue(totalQuestions) || correct + wrong;
  const correctPercent = questionCount ? Math.round((correct / questionCount) * 100) : 0;
  const isSuccess = questionCount > 0 && correctPercent >= 50;

  return (
    <div className="results-overlay">
      <section className="results-screen" aria-label="نتائج اللعبة" dir="rtl">
        <div className="results-panel" style={{ '--results-panel-image': `url(${panelFrame})` }}>
          <img className="results-panel__frame" src={panelFrame} alt="" aria-hidden="true" />
          <div className="results-panel__content">
            {isSuccess ? (
              <img className="results-panel__title" src={celebrationTitle} alt="أحسنت" />
            ) : (
              <div className="results-panel__fail-title">حاول مرة أخرى!</div>
            )}
            <div className="results-grade" aria-label={`الدرجة ${correctPercent} من 100`}>
              <span>الدَّرَجَة</span>
              <strong>{correctPercent}/100</strong>
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
        <div className="results-actions" aria-label="إجراءات النتائج">
          <button className="results-action results-action--back" type="button" onClick={onBack} aria-label="خروج">
            <img className="results-action__bg" src={exitButtonImage} alt="خروج" />
          </button>
          <button className="results-action results-action--retry" type="button" onClick={onRetry} aria-label="إعادة المحاولة">
            <img className="results-action__bg" src={retryButtonImage} alt="إعادة المحاولة" />
          </button>
        </div>
      </section>
    </div>
  );
}
