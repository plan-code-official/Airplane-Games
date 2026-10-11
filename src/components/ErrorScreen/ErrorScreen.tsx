import React from 'react';
import error404Img from '../../assets/404.png';
import './ErrorScreen.css';

export interface ErrorScreenProps {
  titleLine1?: string;
  titleLine2?: string;
  titleLine3?: string;
  description?: string;
  buttonText?: string;
  onExit?: () => void;
  hideButton?: boolean;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  titleLine1 = 'يبدو',
  titleLine2 = 'أن حكيم',
  titleLine3 = 'تائه',
  description = 'لا يمكننا العثور على هذه الصفحة. دعنا نذهب إلى مكان مألوف.',
  buttonText = 'العودة للرئيسية',
  onExit,
  hideButton = false,
}) => {
  return (
    <main className="error-screen" dir="rtl">
      {/* Main Content & Description Section */}
      <section className="error-screen__content">
        {/* Main Heading */}
        <h1 className="error-screen__title">
          {titleLine1}
          <br />
          {titleLine2}
          {titleLine3 && (
            <>
              <br />
              {titleLine3}
            </>
          )}
        </h1>

        {/* Supporting Text */}
        {/* {description && (
          <p className="error-screen__description">
            {description}
          </p>
        )} */}

        {/* Call to Action Navigation Button */}
        {!hideButton && onExit && (
          <button
            onClick={onExit}
            type="button"
            className="error-screen__btn"
            aria-label={buttonText}
          >
            {buttonText}
          </button>
        )}
      </section>

      {/* Visual Assets Section */}
      <section className="error-screen__visual">
        <img
          src={error404Img}
          alt="404 - حكيم تائه"
          className="error-screen__illustration"
          loading="lazy"
        />
      </section>
    </main>
  );
};

export default ErrorScreen;
