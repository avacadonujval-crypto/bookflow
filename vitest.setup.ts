import { vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => null),
}));
