"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleCheckIn } from "@/hooks/use-guests";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CheckInButtonProps {
  guestId: string;
  eventId: string;
  guestName: string;
  isCheckedIn: boolean;
}

export function CheckInButton({
  guestId,
  eventId,
  guestName,
  isCheckedIn,
}: CheckInButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await toggleCheckIn(guestId, eventId, isCheckedIn);
      toast.success(
        isCheckedIn
          ? `${guestName} checked out`
          : `${guestName} checked in! 🎉`
      );
    } catch (error) {
      toast.error("Failed to update check-in status");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size="lg"
      className={cn(
        "min-w-[120px] font-semibold transition-all",
        isCheckedIn
          ? "bg-red-500 hover:bg-red-600 text-white"
          : "bg-green-500 hover:bg-green-600 text-white"
      )}
    >
      {loading ? (
        <span className="animate-pulse">...</span>
      ) : isCheckedIn ? (
        <>
          <X className="mr-2 h-5 w-5" />
          CHECK OUT
        </>
      ) : (
        <>
          <Check className="mr-2 h-5 w-5" />
          CHECK IN
        </>
      )}
    </Button>
  );
}
