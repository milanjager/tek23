import { createFileRoute } from "@tanstack/react-router";
import { StageBuilder3D } from "@/components/stage/StageBuilder3D";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stage Rig — Tekno Sound System Builder" },
      {
        name: "description",
        content:
          "Postav si tekno stage drag-and-dropem: horny, středy, basy, světla, stroboskopy, bar a zapojení kabelů.",
      },
      { property: "og:title", content: "Stage Rig — Tekno Sound System Builder" },
      {
        property: "og:description",
        content:
          "Drag-and-drop plánovač free tekno party — reproduktory, světla, kabely a rozložení stage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <StageBuilder3D />;
}
