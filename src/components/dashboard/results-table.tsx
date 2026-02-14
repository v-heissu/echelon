'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ExternalLink, Sparkles } from 'lucide-react';
import { SerpResultWithAnalysis, Sentiment } from '@/types/database';
import { truncate } from '@/lib/utils';

interface ResultsTableProps {
  results: SerpResultWithAnalysis[];
  onTagClick?: (tag: string) => void;
}

export function ResultsTable({ results, onTagClick }: ResultsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('position');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const sorted = [...results].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortField];
    const bVal = (b as unknown as Record<string, unknown>)[sortField];
    const dir = sortDir === 'asc' ? 1 : -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
    return String(aVal || '').localeCompare(String(bVal || '')) * dir;
  });

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    );
  };

  return (
    <div className="bg-white rounded-xl border-0 shadow-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer w-[60px]" onClick={() => handleSort('position')}>
              # <SortIcon field="position" />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>
              Titolo <SortIcon field="title" />
            </TableHead>
            <TableHead className="cursor-pointer w-[140px]" onClick={() => handleSort('domain')}>
              Dominio <SortIcon field="domain" />
            </TableHead>
            <TableHead className="cursor-pointer w-[100px]" onClick={() => handleSort('keyword')}>
              Keyword <SortIcon field="keyword" />
            </TableHead>
            <TableHead className="w-[100px]">Source</TableHead>
            <TableHead className="w-[90px]">Sentiment</TableHead>
            <TableHead className="w-[140px]">Tag</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((result) => {
            const analysis = result.ai_analysis;
            const isExpanded = expandedId === result.id;

            return (
              <>
                <TableRow
                  key={result.id}
                  className={`hover:bg-muted/30 transition-colors ${result.is_competitor ? 'border-l-4 border-l-orange' : ''}`}
                >
                  <TableCell className="font-mono text-sm text-muted-foreground">{result.position}</TableCell>
                  <TableCell>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline text-sm flex items-center gap-1"
                    >
                      {truncate(result.title, 60)}
                      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
                    </a>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{result.domain}</div>
                    {result.fetched_at && result.source === 'google_news' && (
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {new Date(result.fetched_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{result.keyword}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {result.source === 'google_organic' ? 'Web' : 'News'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {analysis && (
                      <Badge variant={analysis.sentiment as Sentiment}>
                        {analysis.sentiment}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {analysis?.themes?.slice(0, 2).map((t) => (
                        <span
                          key={t.name}
                          className="inline-block bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full cursor-pointer hover:bg-accent/20 transition-colors font-medium"
                          onClick={() => onTagClick?.(t.name)}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setExpandedId(isExpanded ? null : result.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow key={`${result.id}-expanded`}>
                    <TableCell colSpan={8} className="bg-muted/30 p-5">
                      <div className="space-y-4 text-sm animate-fade-in-up">
                        {analysis?.summary && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-accent" />
                              <span className="font-semibold text-primary text-xs uppercase tracking-wide">Sommario AI</span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{analysis.summary}</p>
                          </div>
                        )}
                        {result.excerpt && (
                          <div>
                            <span className="font-semibold text-primary text-xs uppercase tracking-wide">Excerpt</span>
                            <p className="text-muted-foreground mt-1 line-clamp-4 leading-relaxed">
                              {result.excerpt}
                            </p>
                          </div>
                        )}
                        {analysis?.entities && analysis.entities.length > 0 && (
                          <div>
                            <span className="font-semibold text-primary text-xs uppercase tracking-wide">Entita</span>
                            <div className="flex gap-1.5 flex-wrap mt-1.5">
                              {analysis.entities.map((e, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {e.name} <span className="text-muted-foreground ml-0.5">({e.type})</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis?.themes && (
                          <div>
                            <span className="font-semibold text-primary text-xs uppercase tracking-wide">Tutti i temi</span>
                            <div className="flex gap-1.5 flex-wrap mt-1.5">
                              {analysis.themes.map((t) => (
                                <span
                                  key={t.name}
                                  className="inline-block bg-accent/10 text-accent text-xs px-2.5 py-1 rounded-full cursor-pointer hover:bg-accent/20 transition-colors font-medium"
                                  onClick={() => onTagClick?.(t.name)}
                                >
                                  {t.name}{typeof t.confidence === 'number' && !isNaN(t.confidence) ? ` (${(t.confidence * 100).toFixed(0)}%)` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
                          <span>Score: <strong>{analysis?.sentiment_score?.toFixed(2) || '—'}</strong></span>
                          <span>Lingua: <strong>{analysis?.language_detected || '—'}</strong></span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      {results.length === 0 && (
        <div className="p-12 text-center text-muted-foreground">
          Nessun risultato trovato
        </div>
      )}
    </div>
  );
}
