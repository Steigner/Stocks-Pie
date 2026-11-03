import { useMemo } from 'react';
import type { PortfolioValidationError } from './domain/types';
import { createFormatters } from './format';
import { usePortfolio } from './state/PortfolioContext';
import { TRANSLATIONS } from './translations';

export function useTranslation() {
  const { language, setLanguage } = usePortfolio();
  const text = TRANSLATIONS[language];
  const formatters = useMemo(() => createFormatters(language), [language]);

  return {
    language,
    setLanguage,
    text,
    ...formatters,
    validationMessage: (error: PortfolioValidationError): string =>
      error.issue.code === 'targetsTotal'
        ? text.targetsTotal(formatters.formatPct(error.issue.totalPct, 2))
        : text.validation[error.issue.code],
  };
}
