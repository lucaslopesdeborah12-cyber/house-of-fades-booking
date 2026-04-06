import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WaitingListDecline = () => {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const processDecline = async () => {
      const id = params.get("id");
      if (!id) { setDone(true); return; }

      await supabase.from("waiting_list").update({ status: "declined" }).eq("id", id);
      setDone(true);
    };
    processDecline();
  }, [params]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {!done ? (
          <Loader2 className="w-16 h-16 mx-auto text-accent animate-spin" />
        ) : (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">No problem!</h1>
            <p className="text-muted-foreground font-body">Your spot has been removed from the waiting list.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default WaitingListDecline;
