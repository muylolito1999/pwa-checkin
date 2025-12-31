"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RecentCheckinsProps {
  checkins: Array<{
    name: string;
    time: string;
    type: "IN" | "OUT";
  }>;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function RecentCheckins({ checkins }: RecentCheckinsProps) {
  if (checkins.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          No recent activity
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checkins.map((checkin, index) => (
            <div
              key={index}
              className="flex items-center gap-3 text-sm"
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  checkin.type === "IN"
                    ? "bg-green-500/10 text-green-500"
                    : "bg-red-500/10 text-red-500"
                )}
              >
                {checkin.type === "IN" ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{checkin.name}</p>
                <p className="text-xs text-muted-foreground">
                  {checkin.type === "IN" ? "Checked in" : "Checked out"}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatTime(checkin.time)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
