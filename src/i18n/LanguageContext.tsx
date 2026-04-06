import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { translations, type LangCode } from "./translations";

interface LanguageContextType {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<LangCode>(() => {
    const saved = localStorage.getItem("hof-lang") as LangCode | null;
    return saved && translations[saved] ? saved : "en";
  });

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    localStorage.setItem("hof-lang", code);
  }, []);

  const t = useCallback(
    (key: string) => translations[lang]?.[key] || translations.en[key] || key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
