import { Instagram, Facebook, Phone } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const FooterSection = () => {
  const { t } = useLanguage();

  return (
    <footer className="relative border-t border-white/5 px-4 py-16">
      <div className="absolute left-0 right-0 top-0 h-px bg-[linear-gradient(90deg,transparent,hsla(43,74%,52%,0.6),transparent)] shadow-[0_0_16px_hsla(43,74%,52%,0.24)]" />
      <div className="container mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h3 className="gold-title-gradient font-serif text-3xl font-bold">House of Fades</h3>
            <p className="mt-3 font-body text-sm text-muted-foreground">EST. 2025 — Carlow, Ireland</p>
          </div>
          <div>
            <h4 className="font-body text-xs uppercase tracking-[0.35em] text-accent">{t("footer.quickLinks")}</h4>
            <div className="mt-4 space-y-3 font-body text-sm">
              <a href="#services" className="block text-muted-foreground transition-colors hover:text-accent">{t("nav.services")}</a>
              <a href="#team" className="block text-muted-foreground transition-colors hover:text-accent">{t("nav.team")}</a>
              <a href="#reviews" className="block text-muted-foreground transition-colors hover:text-accent">{t("nav.reviews")}</a>
              <a href="#contact" className="block text-muted-foreground transition-colors hover:text-accent">{t("nav.contact")}</a>
            </div>
          </div>
          <div>
            <h4 className="font-body text-xs uppercase tracking-[0.35em] text-accent">{t("footer.followUs")}</h4>
            <div className="mt-4 flex gap-4">
              <a href="https://www.facebook.com/No6barbershop/#" target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-muted-foreground transition-all hover:border-accent/40 hover:text-accent">
                <Facebook size={18} />
              </a>
              <a href="mailto:jeffkavna@gmail.com" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-muted-foreground transition-all hover:border-accent/40 hover:text-accent">
                <Mail size={18} />
              </a>
              <a href="tel:+353858544561" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-muted-foreground transition-all hover:border-accent/40 hover:text-accent" title="+353 (85) 854 4561">
                <Phone size={18} />
              </a>
            </div>
          </div>
        </div>
        <div className="section-divider my-10" />
        <p className="text-center font-body text-xs text-muted-foreground">© {new Date().getFullYear()} House of Fades. {t("footer.rights")}</p>
      </div>
    </footer>
  );
};

export default FooterSection;
