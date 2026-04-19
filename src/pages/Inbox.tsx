import { InboxLayout } from "@/components/inbox/InboxLayout";
import { Helmet } from "react-helmet-async";

export default function Inbox() {
  return (
    <>
      <Helmet>
        <title>Inbox unificada — Porta do Corretor</title>
        <meta name="description" content="Atenda conversas omnichannel em um só lugar." />
      </Helmet>
      <main>
        <h1 className="sr-only">Inbox unificada</h1>
        <InboxLayout />
      </main>
    </>
  );
}
