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
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
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
    <div className="bg-white rounded-lg border border-border overflow-hidden">
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
                  className={result.is_competitor ? 'border-l-4 border-l-orange' : ''}
                >
                  <TableCell className="font-mono text-sm">{result.position}</TableCell>
                  <TableCell>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline text-sm flex items-center gap-1"
                    >
                      {truncate(result.title, 60)}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="text-xs">{result.domain}</TableCell>
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
                          className="inline-block bg-teal-light/20 text-teal text-xs px-1.5 py-0.5 rounded cursor-pointer hover:bg-teal-light/40"
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
                      className="h-6 w-6"
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
                    <TableCell colSpan={8} className="bg-muted/50 p-4">
                      <div className="space-y-3 text-sm">
                        {analysis?.summary && (
                          <div>
                            <span className="font-medium">Sommario AI:</span>
                            <p className="text-muted-foreground mt-1">{analysis.summary}</p>
                          </div>
                        )}
                        {result.excerpt && (
                          <div>
                            <span className="font-medium">Excerpt:</span>
                            <p className="text-muted-foreground mt-1 line-clamp-4">
                              {result.excerpt}
                            </p>
                          </div>
                        )}
                        {analysis?.entities && analysis.entities.length > 0 && (
                          <div>
                            <span className="font-medium">Entità:</span>
                            <div className="flex gap-1 flex-wrap mt-1">
                              {analysis.entities.map((e, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {e.name} ({e.type})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis?.themes && (
                          <div>
                            <span className="font-medium">Tutti i temi:</span>
                            <div className="flex gap-1 flex-wrap mt-1">
                              {analysis.themes.map((t) => (
                                <span
                                  key={t.name}
                                  className="inline-block bg-teal-light/20 text-teal text-xs px-2 py-1 rounded cursor-pointer hover:bg-teal-light/40"
                                  onClick={() => onTagClick?.(t.name)}
                                >
                                  {t.name} ({(t.confidence * 100).toFixed(0)}%)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Score: {analysis?.sentiment_score?.toFixed(2) || '—'}</span>
                          <span>Lingua: {analysis?.language_detected || '—'}</span>
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
        <div className="p-8 text-center text-muted-foreground">
          Nessun risultato trovato
        </div>
      )}
    </div>
  );
}
