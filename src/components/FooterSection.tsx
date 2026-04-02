import { Instagram, Facebook, Phone } from "lucide-react";

const FooterSection = () => {
  return (
    <footer className="bg-secondary border-t border-border py-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-serif text-xl font-bold mb-2">House of Fades</h3>
            <p className="text-muted-foreground font-body text-sm">
              EST. 2025 — Carlow, Ireland
            </p>
          </div>
          <div>
            <h4 className="font-serif text-sm font-semibold mb-3 uppercase tracking-wider">Quick Links</h4>
            <div className="space-y-2 font-body text-sm">
              <a href="#services" className="block text-muted-foreground hover:text-foreground transition-colors">Services</a>
              <a href="#team" className="block text-muted-foreground hover:text-foreground transition-colors">Team</a>
              <a href="#reviews" className="block text-muted-foreground hover:text-foreground transition-colors">Reviews</a>
              <a href="#contact" className="block text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
          <div>
            <h4 className="font-serif text-sm font-semibold mb-3 uppercase tracking-wider">Follow Us</h4>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Phone size={20} />
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-6 text-center">
          <p className="text-muted-foreground font-body text-xs">
            © {new Date().getFullYear()} House of Fades. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
