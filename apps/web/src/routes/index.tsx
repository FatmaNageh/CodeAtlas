import { createFileRoute } from "@tanstack/react-router";
import { CodeAtlasHomePage } from "@/components/onboarding/CodeAtlasHomePage";

export const Route = createFileRoute("/")({
  component: CodeAtlasHomePage,
});