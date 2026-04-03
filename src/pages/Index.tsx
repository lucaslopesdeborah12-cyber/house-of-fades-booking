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

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <CursorGlow />
      <Navbar />
      <HeroSection />
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <ServicesSection />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <TeamSection />
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
    </div>
  );
};

export default Index;
