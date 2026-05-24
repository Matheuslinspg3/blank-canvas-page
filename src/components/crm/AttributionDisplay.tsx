import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Globe, MousePointer2 } from 'lucide-react';

interface AttributionDisplayProps {
  attribution: any;
}

export function AttributionDisplay({ attribution }: AttributionDisplayProps) {
  if (!attribution) return null;

  const { utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, fbclid, gclid } = attribution;

  const hasUTM = utm_source || utm_medium || utm_campaign;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Megaphone className="h-4 w-4" />
        Rastreabilidade (Marketing)
      </div>

      <div className="grid grid-cols-1 gap-2">
        {hasUTM && (
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/50 border border-border/50">
            {utm_source && (
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                Origem: {utm_source}
              </Badge>
            )}
            {utm_medium && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300">
                Meio: {utm_medium}
              </Badge>
            )}
            {utm_campaign && (
              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
                Campanha: {utm_campaign}
              </Badge>
            )}
            {utm_term && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300">
                Termo: {utm_term}
              </Badge>
            )}
            {utm_content && (
              <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300">
                Conteúdo: {utm_content}
              </Badge>
            )}
          </div>
        )}

        {(fbclid || gclid) && (
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-center gap-1.5 w-full mb-1">
              <MousePointer2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">Click IDs</span>
            </div>
            {fbclid && (
              <Badge variant="outline" className="text-[10px] font-mono border-blue-200">
                FBCLID: {fbclid.substring(0, 8)}...
              </Badge>
            )}
            {gclid && (
              <Badge variant="outline" className="text-[10px] font-mono border-orange-200">
                GCLID: {gclid.substring(0, 8)}...
              </Badge>
            )}
          </div>
        )}

        {referrer && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-dashed text-[10px] text-muted-foreground truncate">
            <Globe className="h-3 w-3 shrink-0" />
            Vindo de: <span className="truncate italic">{referrer}</span>
          </div>
        )}
      </div>
    </div>
  );
}
