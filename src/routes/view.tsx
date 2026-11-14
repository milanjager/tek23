import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ViewerBody = lazy(() => import("@/components/stage/SharedViewer"));

export const Route = createFileRoute("/view")({
  head: () => ({
    meta: [
      { title: "Sdílený rig — jen pro čtení · Stage Rig" },
      { name: "description", content: "Read-only náhled stage rigu pro crew: 3D, půdorys a schéma zapojení." },
      { property: "og:title", content: "Sdílený rig — jen pro čtení · Stage Rig" },
      { property: "og:description", content: "Crew vidí 3D, půdorys i schéma zapojení, ale nemůže nic měnit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ViewPage,
});

function ViewPage() {
  return (
    <ClientOnly fallback={<div className="grid h-dvh place-items-center bg-neutral-100 text-neutral-600">Načítám rig…</div>}>
      <Suspense fallback={<div className="grid h-dvh place-items-center bg-neutral-100 text-neutral-600">Načítám rig…</div>}>
        <ViewerBody />
      </Suspense>
    </ClientOnly>
  );
}

