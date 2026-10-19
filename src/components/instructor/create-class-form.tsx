"use client";

import { useActionState } from "react";
import {
  createClass,
  type InstructorActionState,
} from "@/lib/actions/instructor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: InstructorActionState = { ok: false };

export function CreateClassForm() {
  const [state, action, pending] = useActionState(createClass, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create class</CardTitle>
        <CardDescription>Add a new teaching cohort in BookFlow</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Class name</Label>
            <Input id="name" name="name" required placeholder="EDU 210" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional overview for learners"
            />
          </div>
          {state.message ? (
            <p
              className={
                state.ok ? "text-sm text-foreground" : "text-sm text-foreground"
              }
            >
              {state.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create class"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
