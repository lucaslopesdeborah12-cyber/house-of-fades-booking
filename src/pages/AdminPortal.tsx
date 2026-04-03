import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Layout, Users } from "lucide-react";
import AdminLogin from "@/components/admin/AdminLogin";
import EditClientViewTab from "@/components/admin/EditClientViewTab";
import EditBarberViewTab from "@/components/admin/EditBarberViewTab";

const AdminPortal = () => {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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
    if (!session?.user) { setIsAdmin(false); setLoading(false); return; }
    const checkAdmin = async () => {
      const { data } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setIsAdmin(!!data);
      setLoading(false);
    };
    checkAdmin();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading…</p>
      </div>
    );
  }

  if (!session) return <AdminLogin />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="font-serif text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground font-body mb-4">You don't have admin privileges.</p>
          <Button onClick={handleLogout} variant="outline" className="border-border text-foreground">Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-secondary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <span className="font-serif text-lg text-primary-foreground">Lopes</span>
            <span className="text-muted-foreground font-body text-sm ml-3">Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut size={16} className="mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="client-view">
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="client-view" className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Layout size={16} className="mr-1.5" /> Edit Client View
            </TabsTrigger>
            <TabsTrigger value="barber-view" className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users size={16} className="mr-1.5" /> Edit Barber View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client-view">
            <EditClientViewTab />
          </TabsContent>
          <TabsContent value="barber-view">
            <EditBarberViewTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPortal;
