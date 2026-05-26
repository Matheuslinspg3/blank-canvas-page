import { Navigate } from "react-router-dom";

// Página movida para Automações → aba "Chat".
export default function WhatsAppChat() {
  return <Navigate to="/automacoes" replace />;
}
