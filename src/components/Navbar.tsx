import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Home", href: "#hero" },
  { label: "Services", href: "#services" },
  { label: "Team", href: "#team" },
  { label: "Reviews", href: "#reviews" },
  { label: "Contact", href: "#contact" },
];

const Navbar = ({ onBookNow }: { onBookNow?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
            <a key={l.label} href={l.href} className="text-sm font-body text-foreground/70 hover:text-accent transition-colors duration-300 tracking-[0.05em]">
              {l.label}
            </a>
          ))}
          <button
            onClick={onBookNow}
            className="btn-primary-glow btn-book-pulse text-primary-foreground px-5 py-2 rounded text-sm font-medium font-body tracking-[0.05em]"
          >
            Book Now
          </button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-secondary/90 backdrop-blur-xl border-t border-white/[0.06] px-4 pb-4">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="block py-3 text-foreground hover:text-accent transition-colors font-body tracking-[0.05em]" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <button
            onClick={() => { setOpen(false); onBookNow?.(); }}
            className="block w-full mt-2 btn-primary-glow btn-book-pulse text-primary-foreground px-5 py-2 rounded text-sm font-medium text-center font-body tracking-[0.05em]"
          >
            Book Now
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
