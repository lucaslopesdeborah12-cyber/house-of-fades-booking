import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import SectionDivider from "@/components/SectionDivider";
import ServicesSection from "@/components/ServicesSection";
import TeamSection from "@/components/TeamSection";
import ReviewsSection from "@/components/ReviewsSection";
import AboutSection from "@/components/AboutSection";
import HoursLocationSection from "@/components/HoursLocationSection";
import FooterSection from "@/components/FooterSection";
import CursorGlow from "@/components/CursorGlow";
import ScrollReveal from "@/components/ScrollReveal";
import GoldLine from "@/components/GoldLine";
import BookingModal from "@/components/BookingModal";
import AuthModal from "@/components/AuthModal";

const Index = () => {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [preselectedBarber, setPreselectedBarber] = useState<string | undefined>();

  const openAuth = (barberName?: string) => {
    setPreselectedBarber(barberName);
    setAuthOpen(true);
  };

  const handleAuthContinue = () => {
    setAuthOpen(false);
    setBookingOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <CursorGlow />
      <Navbar onBookNow={() => openBooking()} />
      <HeroSection onBookNow={() => openBooking()} />
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <ServicesSection onBookNow={() => openBooking()} />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <TeamSection onBookWithBarber={(name) => openBooking(name)} />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <ReviewsSection />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <AboutSection />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <HoursLocationSection />
      </ScrollReveal>
      <SectionDivider />
      <FooterSection />
      <BookingModal open={bookingOpen} onOpenChange={setBookingOpen} preselectedBarber={preselectedBarber} />
    </div>
  );
};

export default Index;
