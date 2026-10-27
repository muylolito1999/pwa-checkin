"use client";

import { Users, UserCheck, UserX, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuestStats } from "@/types";

interface StatCardsProps {
  stats: GuestStats;
}

export function StatCards({ stats }: StatCardsProps) {
  const cards = [
    {
      title: "Total Guests",
      value: stats.total,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Checked In",
      value: stats.checkedIn,
      icon: UserCheck,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      percentage: stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0,
    },
    {
      title: "Not Arrived",
      value: stats.notArrived,
      icon: UserX,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Left",
      value: stats.left,
      icon: LogOut,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              {card.percentage !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {card.percentage}% of total
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
