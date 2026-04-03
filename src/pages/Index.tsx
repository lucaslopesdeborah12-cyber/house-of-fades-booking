import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import SectionDivider from "@/components/SectionDivider";
import ServicesSection from "@/components/ServicesSection";
import TeamSection from "@/components/TeamSection";
import ReviewsSection from "@/components/ReviewsSection";
import AboutSection from "@/components/AboutSection";
import HoursLocationSection from "@/components/HoursLocationSection";
import FooterSection from "@/components/FooterSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <SectionDivider />
      <ServicesSection />
      <SectionDivider />
      <TeamSection />
      <SectionDivider />
      <ReviewsSection />
      <SectionDivider />
      <AboutSection />
      <SectionDivider />
      <HoursLocationSection />
      <SectionDivider />
      <FooterSection />
    </div>
  );
};

export default Index;
