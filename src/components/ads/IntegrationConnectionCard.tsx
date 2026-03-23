import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, LogIn } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface IntegrationConnectionCardProps {
  platform: string;
  platformIcon: React.ReactNode;
  description: string;
  isConnected: boolean;
  isExpired?: boolean;
  accountInfo?: string;
  accountName?: string;
  isConnecting?: boolean;
  isSyncing?: boolean;
  syncMessage?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  connectLabel?: string;
  disconnectLabel?: string;
  helpText?: string;
}

export default function IntegrationConnectionCard({
  platform,
  platformIcon,
  description,
  isConnected,
  isExpired = false,
  accountInfo,
  accountName,
  isConnecting = false,
  isSyncing = false,
  syncMessage,
  onConnect,
  onDisconnect,
  connectLabel = "Conectar",
  disconnectLabel = "Desconectar",
  helpText,
}: IntegrationConnectionCardProps) {
  const statusBadge = isConnected ? (
    isExpired ? (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Token Expirado
      </Badge>
    ) : (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Conectado
      </Badge>
    )
  ) : (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="h-3 w-3" /> Desconectado
    </Badge>
  );

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {platformIcon}
            {platform}
          </CardTitle>
          {statusBadge}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            {accountInfo && (
              <p className="text-sm text-muted-foreground">
                Conta: <strong className="text-foreground">{accountInfo}</strong>
              </p>
            )}
            {accountName && (
              <p className="text-sm text-muted-foreground">
                Nome: <strong className="text-foreground">{accountName}</strong>
              </p>
            )}
            {isSyncing && syncMessage && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {syncMessage}
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              {isExpired && (
                <Button onClick={onConnect} disabled={isConnecting} size="sm">
                  {isConnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Reconectar
                </Button>
              )}
              <DisconnectButton platform={platform} label={disconnectLabel} onDisconnect={onDisconnect} />
          </div>
        ) : (
          <div className="space-y-3">
            {helpText && (
              <p className="text-sm text-muted-foreground">{helpText}</p>
            )}
            <Button onClick={onConnect} disabled={isConnecting} className="gap-2">
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {isConnecting ? "Redirecionando..." : connectLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
