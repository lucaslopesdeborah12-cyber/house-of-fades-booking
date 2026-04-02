import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
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
      <ServicesSection />
      <TeamSection />
      <ReviewsSection />
      <AboutSection />
      <HoursLocationSection />
      <FooterSection />
    </div>
  );
};

export default Index;
