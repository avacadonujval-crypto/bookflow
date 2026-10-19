"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  ClipboardList,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Library,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export function PublisherShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      title="Publisher"
      userName={userName}
      userRole="Publisher"
      items={[
        { href: "/publisher", label: "Dashboard", icon: LayoutDashboard },
        { href: "/publisher/books", label: "Books", icon: BookOpen },
        { href: "/publisher/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/publisher/ai", label: "AI Assist", icon: Bot },
      ]}
    >
      {children}
    </AppShell>
  );
}

export function InstructorShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      title="Instructor"
      userName={userName}
      userRole="Instructor"
      items={[
        { href: "/instructor", label: "Dashboard", icon: LayoutDashboard },
        { href: "/instructor/classes", label: "Classes", icon: GraduationCap },
        { href: "/instructor/reports", label: "Reports", icon: BarChart3 },
      ]}
    >
      {children}
    </AppShell>
  );
}

export function StudentShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      title="Student"
      userName={userName}
      userRole="Student"
      items={[
        { href: "/student", label: "Dashboard", icon: LayoutDashboard },
        { href: "/student/library", label: "Library", icon: Library },
        {
          href: "/student/assignments",
          label: "Assignments",
          icon: ClipboardList,
        },
      ]}
    >
      {children}
    </AppShell>
  );
}

export function OrgShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      title="Organization"
      userName={userName}
      userRole="Org Admin"
      items={[
        { href: "/org", label: "Dashboard", icon: LayoutDashboard },
        { href: "/org/users", label: "Users", icon: Users },
        { href: "/org/licenses", label: "Licenses", icon: KeyRound },
      ]}
    >
      {children}
    </AppShell>
  );
}
