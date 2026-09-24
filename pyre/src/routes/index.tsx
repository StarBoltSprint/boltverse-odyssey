import { createFileRoute } from "@tanstack/react-router";
import { PyreStage } from "@/game/pyre-stage";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    at: typeof search.at === "string" ? search.at : "",
  }),
  component: Home,
});

function Home() {
  const { at } = Route.useSearch();
  return <PyreStage startInRoom={at === "room" || at === "map"} />;
}
