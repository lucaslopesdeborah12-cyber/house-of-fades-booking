import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

const navLinks = [
  { key: "nav.home", href: "#hero" },
  { key: "nav.services", href: "#services" },
  { key: "nav.team", href: "#team" },
  { key: "nav.reviews", href: "#reviews" },
  { key: "nav.contact", href: "#contact" },
];

const Navbar = ({ onBookNow }: { onBookNow?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-secondary/80 backdrop-blur-xl border-b border-white/[0.06]" : "bg-transparent"}`}>
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <a href="#hero" className="font-serif text-xl tracking-wide gold-shimmer font-bold">
          HOUSE OF FADES
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a key={l.key} href={l.href} className="text-sm font-body text-foreground/70 hover:text-accent transition-colors duration-300 tracking-[0.05em]">
              {t(l.key)}
            </a>
          ))}
          <LanguageSelector />
          <button
            onClick={onBookNow}
            className="btn-primary-glow btn-book-pulse text-primary-foreground px-5 py-2 rounded text-sm font-medium font-body tracking-[0.05em]"
          >
            {t("nav.bookNow")}
          </button>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <LanguageSelector />
          <button className="text-foreground" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-secondary/90 backdrop-blur-xl border-t border-white/[0.06] px-4 pb-4">
          {navLinks.map((l) => (
            <a key={l.key} href={l.href} className="block py-3 text-foreground hover:text-accent transition-colors font-body tracking-[0.05em]" onClick={() => setOpen(false)}>
              {t(l.key)}
            </a>
          ))}
          <button
            onClick={() => { setOpen(false); onBookNow?.(); }}
            className="block w-full mt-2 btn-primary-glow btn-book-pulse text-primary-foreground px-5 py-2 rounded text-sm font-medium text-center font-body tracking-[0.05em]"
          >
            {t("nav.bookNow")}
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
