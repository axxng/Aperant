import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Lightbulb, Zap, Palette, BookOpen, Shield, Gauge, Code2,
  X, Check, Trash2, RefreshCw, Settings, Square, CheckSquare, Ban,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useIdeationStore } from '../stores/ideation-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import type { Idea, IdeationType, IdeationConfig } from '@shared/types/ideation';

const TYPE_STYLES: Record<IdeationType, string> = {
  code_improvements: 'bg-emerald-500/10 text-emerald-500',
  ui_ux_improvements: 'bg-blue-500/10 text-blue-500',
  documentation_gaps: 'bg-amber-500/10 text-amber-500',
  security_hardening: 'bg-red-500/10 text-red-500',
  performance_optimizations: 'bg-purple-500/10 text-purple-500',
  code_quality: 'bg-cyan-500/10 text-cyan-500',
};

const TYPE_ICONS: Record<IdeationType, typeof Zap> = {
  code_improvements: Zap,
  ui_ux_improvements: Palette,
  documentation_gaps: BookOpen,
  security_hardening: Shield,
  performance_optimizations: Gauge,
  code_quality: Code2,
};

const ALL_TYPES: IdeationType[] = [
  'code_improvements',
  'ui_ux_improvements',
  'documentation_gaps',
  'security_hardening',
  'performance_optimizations',
  'code_quality',
];

export function Ideation() {
  const { t } = useTranslation(['ideation', 'common']);
  const { productId } = useParams<{ productId: string }>();
  const {
    ideas, sessionId, config, phase, progress, streamingText, error,
    activeType, selectedIdeaId, selectedIds,
    setSession, setPhase, setProgress, appendStreamingText, clearStreamingText,
    setError, dismissIdea, dismissAll, deleteSelected,
    setActiveType, setSelectedIdeaId, toggleSelectIdea, selectAll, clearSelection,
    getFilteredIdeas, getSummary,
  } = useIdeationStore();

  const [showConfig, setShowConfig] = useState(false);
  const [localConfig, setLocalConfig] = useState<IdeationConfig>({ ...config });

  const filteredIdeas = getFilteredIdeas();
  const summary = getSummary();
  const selectedIdea = ideas.find((i) => i.id === selectedIdeaId) ?? null;
  const isGenerating = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  // Load existing session on mount
  useEffect(() => {
    if (!productId) return;

    (async () => {
      try {
        const response = await fetch(`/api/ideation/${productId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.id) {
            setSession(data.id, data.ideas ?? [], data.config ?? config);
          }
        }
      } catch {
        // No existing session, that's fine
      }
    })();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local config when store config changes
  useEffect(() => {
    setLocalConfig({ ...config });
  }, [config]);

  const handleGenerate = useCallback(async () => {
    if (!productId || isGenerating) return;

    setPhase('analyzing');
    setProgress(0);
    clearStreamingText();
    setError(null);

    try {
      const response = await fetch(`/api/ideation/${productId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabledTypes: localConfig.enabledTypes,
          maxIdeasPerType: localConfig.maxIdeasPerType,
        }),
      });

      if (!response.ok) {
        setError(`HTTP ${response.status}`);
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
                setSession(data.id, data.ideas ?? [], data.config ?? localConfig);
                setPhase('complete');
                setProgress(100);
              } else if (eventType === 'error') {
                setError(data.error ?? data.message ?? 'Generation failed');
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
      }
    }
  }, [
    productId, isGenerating, localConfig, setPhase, setProgress,
    clearStreamingText, setError, appendStreamingText, setSession,
  ]);

  const handleStop = useCallback(() => {
    setPhase('idle');
  }, [setPhase]);

  const handleSelectAll = useCallback(() => {
    selectAll(filteredIdeas.map((i) => i.id));
  }, [filteredIdeas, selectAll]);

  const handleConvertToTask = useCallback(async (ideaId: string) => {
    if (!productId) return;
    try {
      const response = await fetch(`/api/ideation/${productId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId }),
      });
      if (response.ok) {
        const data = await response.json();
        const store = useIdeationStore.getState();
        store.setIdeaTaskId(ideaId, data.taskId);
      }
    } catch {
      // conversion failed silently
    }
  }, [productId]);

  const toggleConfigType = useCallback((type: IdeationType) => {
    setLocalConfig((prev) => {
      const enabled = prev.enabledTypes.includes(type);
      return {
        ...prev,
        enabledTypes: enabled
          ? prev.enabledTypes.filter((t) => t !== type)
          : [...prev.enabledTypes, type],
      };
    });
  }, []);

  // No session, show empty state
  if (!sessionId && phase === 'idle') {
    return (
      <div className="flex h-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <EmptyState onGenerate={handleGenerate} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t('ideation:title')}</h2>
              {summary.total > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {summary.total}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {selectedIds.size > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={clearSelection}
                  >
                    {t('ideation:clearSelection')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    onClick={deleteSelected}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {t('ideation:deleteSelected')}
                  </Button>
                </>
              )}
              {selectedIds.size === 0 && filteredIdeas.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSelectAll}
                >
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  {t('ideation:selectAll')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={dismissAll}
                disabled={isGenerating}
              >
                <Ban className="h-3.5 w-3.5 mr-1" />
                {t('ideation:dismissAll')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowConfig(!showConfig)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                {isGenerating
                  ? t('ideation:generating')
                  : sessionId
                    ? t('ideation:refresh')
                    : t('ideation:generate')}
              </Button>
            </div>
          </div>

          {/* Config panel */}
          {showConfig && (
            <ConfigPanel
              config={localConfig}
              onToggleType={toggleConfigType}
              onMaxChange={(max) => setLocalConfig((prev) => ({ ...prev, maxIdeasPerType: max }))}
            />
          )}

          {/* Generation progress */}
          {isGenerating && (
            <GenerationProgress
              phase={phase}
              progress={progress}
              streamingText={streamingText}
              onStop={handleStop}
            />
          )}

          {/* Error display */}
          {error && (
            <div className="mt-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
              {error}
            </div>
          )}

          {/* Type tabs */}
          <TypeTabs
            activeType={activeType}
            summary={summary}
            onSetType={setActiveType}
          />
        </div>

        {/* Idea grid */}
        <ScrollArea className="flex-1">
          {filteredIdeas.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-8">
              {t('ideation:noIdeas')}
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 gap-3">
              {filteredIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  isSelected={selectedIds.has(idea.id)}
                  onSelect={() => toggleSelectIdea(idea.id)}
                  onClick={() => setSelectedIdeaId(idea.id)}
                  onDismiss={() => dismissIdea(idea.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail panel */}
      {selectedIdea && (
        <IdeaDetailPanel
          idea={selectedIdea}
          onClose={() => setSelectedIdeaId(null)}
          onDismiss={() => dismissIdea(selectedIdea.id)}
          onConvert={() => handleConvertToTask(selectedIdea.id)}
        />
      )}
    </div>
  );
}

/** Type tab bar */
const TypeTabs = memo(function TypeTabs({
  activeType,
  summary,
  onSetType,
}: {
  activeType: IdeationType | 'all';
  summary: { total: number; byType: Record<string, number> };
  onSetType: (type: IdeationType | 'all') => void;
}) {
  const { t } = useTranslation(['ideation']);

  const tabs: Array<{ key: IdeationType | 'all'; label: string; icon?: typeof Zap }> = [
    { key: 'all', label: t('ideation:types.all') },
    ...ALL_TYPES.map((type) => ({
      key: type,
      label: t(`ideation:types.${type}`),
      icon: TYPE_ICONS[type],
    })),
  ];

  return (
    <div className="flex gap-1 mt-3 overflow-x-auto">
      {tabs.map(({ key, label, icon: Icon }) => {
        const count = key === 'all' ? summary.total : (summary.byType[key] ?? 0);
        return (
          <Button
            key={key}
            variant={activeType === key ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => onSetType(key)}
          >
            {Icon && <Icon className="h-3 w-3 mr-1" />}
            {label}
            {count > 0 && (
              <span className="ml-1 opacity-70">({count})</span>
            )}
          </Button>
        );
      })}
    </div>
  );
});

/** Idea card in the grid */
const IdeaCard = memo(function IdeaCard({
  idea,
  isSelected,
  onSelect,
  onClick,
  onDismiss,
}: {
  idea: Idea;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation(['ideation']);
  const isDismissed = idea.status === 'dismissed';

  return (
    <div
      className={cn(
        'relative border border-border rounded-lg p-3 hover:bg-accent/30 transition-colors cursor-pointer',
        isSelected && 'ring-1 ring-primary',
        isDismissed && 'opacity-50'
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        className="absolute top-2.5 left-2.5"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {isSelected ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div className="ml-6">
        {/* Title */}
        <h4 className={cn(
          'text-sm font-medium mb-1',
          isDismissed && 'line-through'
        )}>
          {idea.title}
        </h4>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {idea.description}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <Badge variant="outline" className={cn('text-xs', TYPE_STYLES[idea.type])}>
            {t(`ideation:types.${idea.type}`)}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {idea.status}
          </Badge>
          {idea.estimatedEffort && (
            <Badge variant="secondary" className="text-xs">
              {idea.estimatedEffort}
            </Badge>
          )}
          {idea.severity && (
            <Badge variant="secondary" className="text-xs">
              {idea.severity}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={(e) => { e.stopPropagation(); /* convert handled via detail panel */ }}
          >
            <Check className="h-3 w-3 mr-1" />
            {t('ideation:convertToTask')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          >
            <Ban className="h-3 w-3 mr-1" />
            {t('ideation:dismiss')}
          </Button>
        </div>
      </div>
    </div>
  );
});

/** Idea detail side panel */
function IdeaDetailPanel({
  idea,
  onClose,
  onDismiss,
  onConvert,
}: {
  idea: Idea;
  onClose: () => void;
  onDismiss: () => void;
  onConvert: () => void;
}) {
  const { t } = useTranslation(['ideation']);

  return (
    <div className="w-96 border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Badge variant="outline" className={cn('text-xs', TYPE_STYLES[idea.type])}>
          {t(`ideation:types.${idea.type}`)}
        </Badge>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={onDismiss}>
            <Ban className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Title */}
          <h3 className="text-base font-semibold">{idea.title}</h3>

          {/* Description */}
          <p className="text-sm text-foreground/90">{idea.description}</p>

          {/* Rationale */}
          {idea.rationale && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                {t('ideation:rationale')}
              </h4>
              <p className="text-sm text-foreground/80">{idea.rationale}</p>
            </div>
          )}

          {/* Category */}
          {idea.category && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{t('ideation:category')}:</span>
              <Badge variant="secondary">{idea.category}</Badge>
            </div>
          )}

          {/* Severity & Effort */}
          <div className="flex gap-4 text-xs">
            {idea.severity && (
              <div>
                <span className="text-muted-foreground">{t('ideation:severity')}:</span>
                <Badge variant="secondary" className="ml-1">{idea.severity}</Badge>
              </div>
            )}
            {idea.estimatedEffort && (
              <div>
                <span className="text-muted-foreground">{t('ideation:effort')}:</span>
                <Badge variant="secondary" className="ml-1">{idea.estimatedEffort}</Badge>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t('ideation:status')}:</span>
            <Badge variant="secondary">{idea.status}</Badge>
          </div>

          {/* Affected files */}
          {idea.affectedFiles && idea.affectedFiles.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                {t('ideation:affectedFiles')}
              </h4>
              <ul className="space-y-0.5">
                {idea.affectedFiles.map((file, i) => (
                  <li key={i} className="text-xs font-mono text-foreground/80 truncate">
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Implementation */}
          {idea.implementation && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                {t('ideation:implementation')}
              </h4>
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80 bg-muted/30 rounded-md p-2">
                {idea.implementation}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-border pt-3 flex gap-2">
            <Button
              size="sm"
              onClick={onConvert}
              disabled={idea.status === 'converted'}
            >
              <Check className="h-4 w-4 mr-1" />
              {t('ideation:convertToTask')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDismiss}
              disabled={idea.status === 'dismissed'}
            >
              <Ban className="h-4 w-4 mr-1" />
              {t('ideation:dismiss')}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/** Generation progress indicator */
function GenerationProgress({
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
  const { t } = useTranslation(['ideation']);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{t(`ideation:phase.${phase}`)}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onStop}>
          <X className="h-3 w-3 mr-1" />
          {t('common:stop')}
        </Button>
      </div>
      <div className="h-1 bg-muted rounded-full">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {streamingText && (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans max-h-24 overflow-auto bg-muted/30 rounded-md p-2">
          {streamingText}
        </pre>
      )}
    </div>
  );
}

/** Configuration panel */
function ConfigPanel({
  config,
  onToggleType,
  onMaxChange,
}: {
  config: IdeationConfig;
  onToggleType: (type: IdeationType) => void;
  onMaxChange: (max: number) => void;
}) {
  const { t } = useTranslation(['ideation']);

  return (
    <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-border space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground">
        {t('ideation:configTitle')}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {ALL_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type];
          const enabled = config.enabledTypes.includes(type);
          return (
            <button
              key={type}
              className={cn(
                'flex items-center gap-2 text-xs rounded-md px-2 py-1.5 border transition-colors',
                enabled
                  ? 'border-primary/50 bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent/30'
              )}
              onClick={() => onToggleType(type)}
            >
              {enabled ? (
                <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
              ) : (
                <Square className="h-3.5 w-3.5 shrink-0" />
              )}
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{t(`ideation:types.${type}`)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">
          {t('ideation:maxPerType')}:
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={config.maxIdeasPerType}
          onChange={(e) => onMaxChange(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
          className={cn(
            'w-16 h-7 rounded-md border border-input bg-background px-2 text-xs text-center',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        />
      </div>
    </div>
  );
}

/** Empty state shown when no session exists */
function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  const { t } = useTranslation(['ideation']);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Lightbulb className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{t('ideation:emptyTitle')}</h3>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {t('ideation:emptyDescription')}
      </p>
      <Button onClick={onGenerate}>
        <Zap className="h-4 w-4 mr-1" />
        {t('ideation:generate')}
      </Button>
    </div>
  );
}
