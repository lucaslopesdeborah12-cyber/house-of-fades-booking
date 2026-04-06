import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const DeclineBooking = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ask" | "removed" | "kept">("loading");
  const waitingId = params.get("waitingId");

  useEffect(() => {
    if (!waitingId) {
      setStatus("removed");
      return;
    }
    // Just show the question
    setStatus("ask");
  }, [waitingId]);

  const handleRemove = async () => {
    setStatus("loading");
    await supabase.from("waiting_list").update({ status: "declined" }).eq("id", waitingId!);
    setStatus("removed");
  };

  const handleKeep = () => {
    setStatus("kept");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <Loader2 className="w-16 h-16 mx-auto text-accent animate-spin" />
        )}

        {status === "ask" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-3xl">🤔</span>
            </div>
            <h1 className="font-serif text-2xl text-foreground">Do you want to leave the waiting list?</h1>
            <div className="flex gap-4 justify-center pt-4">
              <Button
                onClick={handleRemove}
                variant="destructive"
                className="font-body px-6 py-3"
              >
                Yes, remove me
              </Button>
              <Button
                onClick={handleKeep}
                className="bg-accent hover:bg-accent/90 text-background font-body px-6 py-3"
              >
                No, keep me in
              </Button>
            </div>
          </>
        )}

        {status === "removed" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">Done!</h1>
            <p className="text-muted-foreground font-body">You have been removed from the waiting list.</p>
          </>
        )}

        {status === "kept" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">No problem!</h1>
            <p className="text-muted-foreground font-body">You're still on the waiting list. We'll notify you when another slot opens up!</p>
          </>
        )}
      </div>
    </div>
  );
};

export default DeclineBooking;
