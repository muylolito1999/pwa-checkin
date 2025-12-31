"use client";

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TimeSlotStats } from "@/types";

interface ArrivalChartProps {
  histogram: TimeSlotStats[];
  timeline: TimeSlotStats[];
  peakWindow: { time: string; count: number } | null;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArrivalChart({ histogram, timeline, peakWindow }: ArrivalChartProps) {
  const histogramData = histogram.map((d) => ({
    time: formatTime(d.time),
    count: d.count,
  }));

  const timelineData = timeline.map((d) => ({
    time: formatTime(d.time),
    count: d.count,
  }));

  if (histogram.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Arrivals</CardTitle>
          <CardDescription>No check-ins recorded yet</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
          Check-in data will appear here
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arrivals</CardTitle>
        <CardDescription>
          {peakWindow && (
            <>
              Peak: <strong>{formatTime(peakWindow.time)}</strong> with{" "}
              <strong>{peakWindow.count}</strong> arrivals
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="histogram">
          <TabsList className="mb-4">
            <TabsTrigger value="histogram">By Time Slot</TabsTrigger>
            <TabsTrigger value="timeline">Cumulative</TabsTrigger>
          </TabsList>

          <TabsContent value="histogram">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="font-medium">{payload[0].payload.time}</div>
                          <div className="text-sm text-muted-foreground">
                            {payload[0].value} arrivals
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="font-medium">{payload[0].payload.time}</div>
                          <div className="text-sm text-muted-foreground">
                            {payload[0].value} total check-ins
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
