import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ConversationFlow } from "@/components/ConversationFlow";

export const Route = createFileRoute("/conversation")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — Let's talk" },
      {
        name: "description",
        content: "Answer a few questions to receive crop-selling guidance.",
      },
    ],
  }),
  component: ConversationPage,
});

function ConversationPage() {
  const navigate = useNavigate();
  return <ConversationFlow onFinish={() => navigate({ to: "/results" })} />;
}
