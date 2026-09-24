import { createFileRoute } from "@tanstack/react-router";
import { PyreStage } from "@/game/pyre-stage";

export const Route = createFileRoute("/room")({
  component: Room,
});

function Room() {
  return <PyreStage startInRoom />;
}
