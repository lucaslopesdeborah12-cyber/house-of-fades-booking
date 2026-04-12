import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, CalendarDays, Users } from "lucide-react";
import OwnerStatsTab from "@/components/barber/OwnerStatsTab";
import EmployeeStatsTab from "@/components/barber/EmployeeStatsTab";
import ScheduleTab from "@/components/barber/ScheduleTab";
import ClientsTab from "@/components/barber/ClientsTab";
import BarberLogin from "@/components/barber/BarberLogin";

type Barber = Tables<"barbers">;

const BarberPortal = () => {
  const [session, setSession] = useState<any>(null);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stats");
  const [scheduleRefreshToken, setScheduleRefreshToken] = useState(0);
  const navigate = useNavigate();

  const forceScheduleRefresh = () => {
    setScheduleRefreshToken((current) => current + 1);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);

    if (value === "schedule") {
      forceScheduleRefresh();
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setBarber(null);
      setLoading(false);
      return;
    }

    const fetchBarber = async () => {
      const { data } = await supabase
        .from("barbers")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setBarber(data);
      setLoading(false);
    };
    fetchBarber();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setBarber(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading…</p>
      </div>
    );
  }

  if (!session) return <BarberLogin />;

  if (!barber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="font-serif text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground font-body mb-4">
            Your account is not linked to a barber profile.
          </p>
          <Button onClick={handleLogout} variant="outline" className="border-border text-foreground">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = barber.role === "owner";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-secondary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <span className="font-serif text-lg text-primary-foreground">House</span>
            <span className="text-muted-foreground font-body text-sm ml-3">
              {barber.name} • {isOwner ? "Owner" : "Barber"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut size={16} className="mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="stats" onValueChange={handleTabChange} value={activeTab}>
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="stats" className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 size={16} className="mr-1.5" />
              {isOwner ? "Shop Stats" : "My Stats"}
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              onClick={() => {
                if (activeTab === "schedule") {
                  forceScheduleRefresh();
                }
              }}
            >
              <CalendarDays size={16} className="mr-1.5" />
              My Schedule
            </TabsTrigger>
            <TabsTrigger value="clients" className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users size={16} className="mr-1.5" />
              Clients
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
            {isOwner ? <OwnerStatsTab /> : <EmployeeStatsTab barberId={barber.id} />}
          </TabsContent>
          <TabsContent value="schedule">
            <ScheduleTab
              key={`${barber.id}-${scheduleRefreshToken}`}
              barberId={barber.id}
              activeTab={activeTab}
              refreshToken={scheduleRefreshToken}
            />
          </TabsContent>
          <TabsContent value="clients">
            <ClientsTab barberId={barber.id} isOwner={isOwner} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BarberPortal;
