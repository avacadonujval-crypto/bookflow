import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="hover-lift">
      <CardHeader className="pb-2">
        <CardTitle className="type-small font-medium uppercase tracking-[0.08em]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="stat-value">{value}</div>
        {hint ? <p className="type-small mt-1">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
