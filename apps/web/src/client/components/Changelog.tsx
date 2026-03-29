import { useState, useCallback, useEffect, memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  FileText, Copy, Check, Trash2, RefreshCw, Loader2, Radio,
  Eye, Edit3, X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useChangelogStore } from '../stores/changelog-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import type {
  ChangelogSourceMode, ChangelogFormat, ChangelogAudience,
} from '@shared/types/changelog';

const SOURCE_MODES: ChangelogSourceMode[] = ['tasks', 'git-history', 'branch-diff'];
const FORMATS: ChangelogFormat[] = ['keep-a-changelog', 'simple-list', 'github-release'];
const AUDIENCES: ChangelogAudience[] = ['technical', 'user-facing', 'marketing'];

export function Changelog() {
  const { t } = useTranslation(['changelog', 'common']);
  const { productId } = useParams<{ productId: string }>();
  const store = useChangelogStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    entries, selectedEntryId, sourceMode, version, date, format, audience,
    customInstructions, phase, progress, streamingText, generatedContent,
    error, previewMode,
    setEntries, addEntry, removeEntry, setSelectedEntryId,
    setSourceMode, setVersion, setDate, setFormat, setAudience,
    setCustomInstructions, setPhase, setProgress, appendStreamingText,
    clearStreamingText, setGeneratedContent, setError, setPreviewMode,
    resetGeneration,
  } = store;

  const isGenerating = phase === 'loading' || phase === 'generating';

  // Load existing changelogs on mount
  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const response = await fetch(`/api/changelog/${productId}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setEntries(data);
          }
        }
      } catch {
        // No existing changelogs
      }
    })();
  }, [productId, setEntries]);

  const handleGenerate = useCallback(async () => {
    if (!productId || isGenerating) return;

    resetGeneration();
    setPhase('generating');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/changelog/${productId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMode, version, date, format, audience, customInstructions,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        setError(`HTTP ${response.status}`);
        setPhase('error');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'status') {
                setPhase(data.phase);
                setProgress(data.progress ?? 0);
              } else if (eventType === 'text') {
                appendStreamingText(data.text);
              } else if (eventType === 'complete') {
                setGeneratedContent(data.content);
                setPhase('complete');
                setProgress(100);
                if (data.entry) {
                  addEntry(data.entry);
                }
              } else if (eventType === 'error') {
                setError(data.error ?? data.message ?? 'Generation failed');
                setPhase('error');
              }
            } catch {
              // skip malformed JSON
            }
            eventType = '';
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setPhase('error');
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    productId, isGenerating, sourceMode, version, date, format, audience,
    customInstructions, resetGeneration, setPhase, setProgress,
    appendStreamingText, setGeneratedContent, setError, addEntry,
  ]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setPhase('idle');
  }, [setPhase]);

  const handleLoadEntry = useCallback((entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    setSelectedEntryId(entryId);
    setGeneratedContent(entry.content);
    setSourceMode(entry.config.sourceMode);
    setVersion(entry.config.version);
    setDate(entry.config.date);
    setFormat(entry.config.format);
    setAudience(entry.config.audience);
    setPreviewMode('preview');
  }, [
    entries, setSelectedEntryId, setGeneratedContent, setSourceMode,
    setVersion, setDate, setFormat, setAudience, setPreviewMode,
  ]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    if (!productId) return;
    try {
      await fetch(`/api/changelog/${productId}/${entryId}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    removeEntry(entryId);
    if (selectedEntryId === entryId) {
      setSelectedEntryId(null);
      setGeneratedContent('');
    }
  }, [productId, selectedEntryId, removeEntry, setSelectedEntryId, setGeneratedContent]);

  const handleSave = useCallback(async () => {
    if (!productId || !generatedContent) return;
    try {
      const response = await fetch(`/api/changelog/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: generatedContent,
          config: { sourceMode, version, date, format, audience },
        }),
      });
      if (response.ok) {
        const entry = await response.json();
        addEntry(entry);
        setSelectedEntryId(entry.id);
      }
    } catch {
      // save failed
    }
  }, [
    productId, generatedContent, sourceMode, version, date, format,
    audience, addEntry, setSelectedEntryId,
  ]);

  // Empty state: no entries and no generated content
  if (entries.length === 0 && !generatedContent && !isGenerating && phase !== 'error') {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState onGenerate={handleGenerate} />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        <ConfigPanel
          sourceMode={sourceMode}
          version={version}
          date={date}
          format={format}
          audience={audience}
          customInstructions={customInstructions}
          isGenerating={isGenerating}
          onSourceModeChange={setSourceMode}
          onVersionChange={setVersion}
          onDateChange={setDate}
          onFormatChange={setFormat}
          onAudienceChange={setAudience}
          onCustomInstructionsChange={setCustomInstructions}
          onGenerate={handleGenerate}
        />

        {/* Previous changelogs */}
        {entries.length > 0 && (
          <div className="flex-1 border-t border-border flex flex-col overflow-hidden">
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
              {t('changelog:previousEntries')}
            </div>
            <ScrollArea className="flex-1">
              <div className="px-2 pb-2 space-y-1">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-xs transition-colors',
                      'hover:bg-accent/30',
                      selectedEntryId === entry.id && 'bg-accent/50',
                    )}
                    onClick={() => handleLoadEntry(entry.id)}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium">
                        v{entry.config.version}
                      </span>
                      <button
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntry(entry.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-muted-foreground">
                      {entry.config.date}
                    </div>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {entry.config.format}
                    </Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isGenerating ? (
          <GenerationOverlay
            phase={phase}
            progress={progress}
            streamingText={streamingText}
            onStop={handleStop}
          />
        ) : (
          <PreviewPanel
            content={generatedContent}
            previewMode={previewMode}
            error={error}
            onContentChange={setGeneratedContent}
            onModeChange={setPreviewMode}
            onSave={handleSave}
            onDelete={() => {
              setGeneratedContent('');
              setSelectedEntryId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Config panel in the left sidebar */
const ConfigPanel = memo(function ConfigPanel({
  sourceMode,
  version,
  date,
  format,
  audience,
  customInstructions,
  isGenerating,
  onSourceModeChange,
  onVersionChange,
  onDateChange,
  onFormatChange,
  onAudienceChange,
  onCustomInstructionsChange,
  onGenerate,
}: {
  sourceMode: ChangelogSourceMode;
  version: string;
  date: string;
  format: ChangelogFormat;
  audience: ChangelogAudience;
  customInstructions: string;
  isGenerating: boolean;
  onSourceModeChange: (mode: ChangelogSourceMode) => void;
  onVersionChange: (version: string) => void;
  onDateChange: (date: string) => void;
  onFormatChange: (format: ChangelogFormat) => void;
  onAudienceChange: (audience: ChangelogAudience) => void;
  onCustomInstructionsChange: (instructions: string) => void;
  onGenerate: () => void;
}) {
  const { t } = useTranslation(['changelog', 'common']);

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* Source Mode */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {t('changelog:sourceMode.label')}
        </label>
        <div className="space-y-1.5">
          {SOURCE_MODES.map((mode) => (
            <button
              key={mode}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md border transition-colors text-xs',
                sourceMode === mode
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent/30',
              )}
              onClick={() => onSourceModeChange(mode)}
            >
              <div className="flex items-center gap-2">
                <Radio
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    sourceMode === mode ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <div>
                  <div className="font-medium">
                    {t(`changelog:sourceMode.${mode}.title`)}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {t(`changelog:sourceMode.${mode}.description`)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Release Info */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {t('changelog:releaseInfo')}
        </label>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="1.0.0"
            value={version}
            onChange={(e) => onVersionChange(e.target.value)}
            className={cn(
              'w-full h-8 rounded-md border border-input bg-background px-3 text-xs',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className={cn(
              'w-full h-8 rounded-md border border-input bg-background px-3 text-xs',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          />
        </div>
      </div>

      {/* Output Style */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {t('changelog:outputStyle')}
        </label>
        <div className="space-y-2">
          <select
            value={format}
            onChange={(e) => onFormatChange(e.target.value as ChangelogFormat)}
            className={cn(
              'w-full h-8 rounded-md border border-input bg-background px-2 text-xs',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {t(`changelog:format.${f}`)}
              </option>
            ))}
          </select>
          <select
            value={audience}
            onChange={(e) => onAudienceChange(e.target.value as ChangelogAudience)}
            className={cn(
              'w-full h-8 rounded-md border border-input bg-background px-2 text-xs',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {t(`changelog:audience.${a}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Instructions */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {t('changelog:customInstructions')}
        </label>
        <textarea
          value={customInstructions}
          onChange={(e) => onCustomInstructionsChange(e.target.value)}
          placeholder={t('changelog:customInstructionsPlaceholder')}
          rows={3}
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        />
      </div>

      {/* Generate Button */}
      <Button
        className="w-full"
        onClick={onGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1" />
        )}
        {isGenerating
          ? t('changelog:generating')
          : t('changelog:generate')}
      </Button>
    </div>
  );
});

/** Preview panel (main content area) */
function PreviewPanel({
  content,
  previewMode,
  error,
  onContentChange,
  onModeChange,
  onSave,
  onDelete,
}: {
  content: string;
  previewMode: 'edit' | 'preview';
  error: string | null;
  onContentChange: (content: string) => void;
  onModeChange: (mode: 'edit' | 'preview') => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation(['changelog', 'common']);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [content]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <div className="text-sm text-destructive">{error}</div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {t('changelog:noContent')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant={previewMode === 'edit' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onModeChange('edit')}
          >
            <Edit3 className="h-3 w-3 mr-1" />
            {t('changelog:edit')}
          </Button>
          <Button
            variant={previewMode === 'preview' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onModeChange('preview')}
          >
            <Eye className="h-3 w-3 mr-1" />
            {t('changelog:preview')}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            {copied ? t('changelog:copied') : t('changelog:copy')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onSave}
          >
            {t('common:save')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {t('changelog:delete')}
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {previewMode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className={cn(
              'w-full h-full min-h-[500px] p-4 bg-background text-sm font-mono resize-none',
              'focus-visible:outline-none',
            )}
          />
        ) : (
          <div className="p-4">
            <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
              {content}
            </pre>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/** Generation overlay shown during streaming */
function GenerationOverlay({
  phase,
  progress,
  streamingText,
  onStop,
}: {
  phase: string;
  progress: number;
  streamingText: string;
  onStop: () => void;
}) {
  const { t } = useTranslation(['changelog', 'common']);
  const scrollRef = useRef<HTMLPreElement>(null);

  // Auto-scroll streaming text
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText]);

  return (
    <div className="flex-1 flex flex-col p-6">
      {/* Phase indicator */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t(`changelog:phase.${phase}`)}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onStop}
          >
            <X className="h-3 w-3 mr-1" />
            {t('common:stop')}
          </Button>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Streaming text */}
      {streamingText && (
        <pre
          ref={scrollRef}
          className={cn(
            'flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-4',
            'text-xs whitespace-pre-wrap font-sans text-foreground/80',
          )}
        >
          {streamingText}
        </pre>
      )}
    </div>
  );
}

/** Empty state when no changelogs exist */
function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  const { t } = useTranslation(['changelog']);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <FileText className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{t('changelog:emptyTitle')}</h3>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {t('changelog:emptyDescription')}
      </p>
      <Button onClick={onGenerate}>
        <RefreshCw className="h-4 w-4 mr-1" />
        {t('changelog:generate')}
      </Button>
    </div>
  );
}
