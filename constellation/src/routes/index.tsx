import { createFileRoute } from "@tanstack/react-router";
import { ConstellationMap } from "@/components/constellation/ConstellationMap";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="h-dvh w-full bg-bg">
      <ConstellationMap />
    </main>
  );
}
