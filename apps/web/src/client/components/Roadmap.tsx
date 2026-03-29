import { useState, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useRoadmapStore } from '../stores/roadmap-store';
import { useProductStore } from '../stores/product-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import {
  Sparkles, Loader2, X, ChevronRight, Target, Users, Calendar,
  Eye, Play, Check, Trash2, ArrowRight, Layers,
} from 'lucide-react';
import type { RoadmapFeature, RoadmapPhase, FeaturePriority, FeatureStatus } from '@shared/types/roadmap';

const PRIORITY_STYLES: Record<FeaturePriority, string> = {
  must: 'bg-red-500/10 text-red-500 border-red-500/30',
  should: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  could: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  wont: 'bg-muted text-muted-foreground border-muted',
};

const STATUS_STYLES: Record<FeatureStatus, string> = {
  under_review: 'bg-muted text-muted-foreground',
  planned: 'bg-blue-500/10 text-blue-500',
  in_progress: 'bg-primary/10 text-primary',
  done: 'bg-green-500/10 text-green-500',
};

export function Roadmap() {
  const { t } = useTranslation(['roadmap', 'common']);
  const { productId } = useParams<{ productId: string }>();
  const { products } = useProductStore();
  const {
    roadmap, isLoading, generationStatus, streamingText, viewMode, selectedFeatureId,
    loadRoadmap, setRoadmap, setGenerationStatus, appendStreamingText,
    setViewMode, selectFeature, updateFeatureStatus, deleteFeature, saveRoadmap, reset,
  } = useRoadmapStore();

  const product = products.find(p => p.id === productId);
  const isGenerating = generationStatus.phase === 'analyzing' || generationStatus.phase === 'generating';
  const selectedFeature = roadmap?.features.find(f => f.id === selectedFeatureId) ?? null;

  useEffect(() => {
    if (productId) {
      loadRoadmap(productId);
      reset();
    }
  }, [productId, loadRoadmap, reset]);

  const handleGenerate = useCallback(async () => {
    if (!productId || !product) return;
    setGenerationStatus({ phase: 'analyzing', progress: 0, message: 'Starting generation...' });

    try {
      const response = await fetch(`/api/roadmap/${productId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: product.name, productDescription: product.description }),
      });

      if (!response.ok) {
        setGenerationStatus({ phase: 'error', progress: 0, message: 'Generation failed', error: `HTTP ${response.status}` });
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
              if (eventType === 'progress') {
                setGenerationStatus({ phase: data.phase, progress: data.progress, message: data.message });
              } else if (eventType === 'roadmap-result') {
                setRoadmap(data);
                setGenerationStatus({ phase: 'complete', progress: 100, message: 'Done!' });
              } else if (eventType === 'text-delta') {
                appendStreamingText(data.text);
              } else if (eventType === 'error') {
                setGenerationStatus({ phase: 'error', progress: 0, message: data.error, error: data.error });
              }
            } catch {}
            eventType = '';
          }
        }
      }
    } catch (err: any) {
      setGenerationStatus({ phase: 'error', progress: 0, message: err.message, error: err.message });
    }
  }, [productId, product, setGenerationStatus, setRoadmap, appendStreamingText]);

  const handleDeleteFeature = useCallback((featureId: string) => {
    deleteFeature(featureId);
    saveRoadmap();
  }, [deleteFeature, saveRoadmap]);

  const handleStatusChange = useCallback((featureId: string, status: FeatureStatus) => {
    updateFeatureStatus(featureId, status);
    saveRoadmap();
  }, [updateFeatureStatus, saveRoadmap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">{t('roadmap:title')}</h2>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {isGenerating ? t('roadmap:generating') : roadmap ? t('roadmap:regenerate') : t('roadmap:generate')}
            </Button>
          </div>

          {/* Generation progress */}
          {isGenerating && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{generationStatus.message}</span>
              </div>
              <div className="h-1 bg-muted rounded-full">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${generationStatus.progress}%` }} />
              </div>
            </div>
          )}

          {generationStatus.phase === 'error' && (
            <div className="mt-2 text-xs text-destructive">{generationStatus.error}</div>
          )}

          {/* Vision + Audience */}
          {roadmap && (
            <div className="mt-2 space-y-1">
              {roadmap.vision && (
                <div className="flex items-start gap-2 text-xs">
                  <Target className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{roadmap.vision}</span>
                </div>
              )}
              {roadmap.targetAudience && (
                <div className="flex items-start gap-2 text-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{roadmap.targetAudience}</span>
                </div>
              )}
            </div>
          )}

          {/* View mode tabs */}
          {roadmap && (
            <div className="flex gap-1 mt-3">
              {(['phases', 'features', 'priority'] as const).map(mode => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setViewMode(mode)}
                >
                  {t(`roadmap:${mode === 'priority' ? 'byPriority' : mode}`)}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {!roadmap ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-8">
              {t('roadmap:noRoadmap')}
            </div>
          ) : viewMode === 'phases' ? (
            <PhasesView
              phases={roadmap.phases}
              features={roadmap.features}
              onSelectFeature={selectFeature}
              selectedFeatureId={selectedFeatureId}
            />
          ) : viewMode === 'features' ? (
            <FeaturesGrid
              features={roadmap.features}
              onSelectFeature={selectFeature}
              selectedFeatureId={selectedFeatureId}
            />
          ) : (
            <PriorityView
              features={roadmap.features}
              onSelectFeature={selectFeature}
              selectedFeatureId={selectedFeatureId}
            />
          )}
        </ScrollArea>
      </div>

      {/* Feature detail panel */}
      {selectedFeature && (
        <FeatureDetailPanel
          feature={selectedFeature}
          onClose={() => selectFeature(null)}
          onDelete={() => handleDeleteFeature(selectedFeature.id)}
          onStatusChange={(status) => handleStatusChange(selectedFeature.id, status)}
        />
      )}
    </div>
  );
}

/** Phases view */
function PhasesView({ phases, features, onSelectFeature, selectedFeatureId }: {
  phases: RoadmapPhase[];
  features: RoadmapFeature[];
  onSelectFeature: (id: string) => void;
  selectedFeatureId: string | null;
}) {
  const { t } = useTranslation(['roadmap']);
  const sorted = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div className="p-4 space-y-4">
      {sorted.map(phase => {
        const phaseFeatures = features.filter(f => f.phaseId === phase.id);
        const doneCount = phaseFeatures.filter(f => f.status === 'done').length;

        return (
          <div key={phase.id} className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{phase.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {t(`roadmap:phaseStatus.${phase.status}`)}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {doneCount}/{phaseFeatures.length}
                </span>
              </div>
              {phase.description && (
                <p className="text-xs text-muted-foreground mt-1">{phase.description}</p>
              )}
              {/* Progress bar */}
              {phaseFeatures.length > 0 && (
                <div className="h-1 bg-muted rounded-full mt-2">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(doneCount / phaseFeatures.length) * 100}%` }}
                  />
                </div>
              )}
            </div>
            <div className="divide-y divide-border">
              {phaseFeatures.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">{t('roadmap:noFeatures')}</p>
              ) : (
                phaseFeatures.map(feature => (
                  <FeatureRow
                    key={feature.id}
                    feature={feature}
                    isSelected={feature.id === selectedFeatureId}
                    onClick={() => onSelectFeature(feature.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Features grid view */
function FeaturesGrid({ features, onSelectFeature, selectedFeatureId }: {
  features: RoadmapFeature[];
  onSelectFeature: (id: string) => void;
  selectedFeatureId: string | null;
}) {
  return (
    <div className="p-4 grid grid-cols-2 gap-3">
      {features.map(feature => (
        <FeatureCard key={feature.id} feature={feature} isSelected={feature.id === selectedFeatureId} onClick={() => onSelectFeature(feature.id)} />
      ))}
    </div>
  );
}

/** Priority view — grouped by MoSCoW */
function PriorityView({ features, onSelectFeature, selectedFeatureId }: {
  features: RoadmapFeature[];
  onSelectFeature: (id: string) => void;
  selectedFeatureId: string | null;
}) {
  const { t } = useTranslation(['roadmap']);
  const groups: FeaturePriority[] = ['must', 'should', 'could', 'wont'];

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      {groups.map(priority => {
        const grouped = features.filter(f => f.priority === priority);
        return (
          <div key={priority} className="border border-border rounded-lg">
            <div className={cn('px-3 py-2 border-b border-border rounded-t-lg', PRIORITY_STYLES[priority])}>
              <span className="text-xs font-medium">{t(`roadmap:priority.${priority}`)}</span>
              <span className="text-xs ml-1 opacity-70">({grouped.length})</span>
            </div>
            <div className="divide-y divide-border">
              {grouped.map(feature => (
                <FeatureRow key={feature.id} feature={feature} isSelected={feature.id === selectedFeatureId} onClick={() => onSelectFeature(feature.id)} />
              ))}
              {grouped.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Feature row (used in phases and priority views) */
const FeatureRow = memo(function FeatureRow({ feature, isSelected, onClick }: {
  feature: RoadmapFeature;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'w-full text-left px-4 py-2.5 hover:bg-accent/30 transition-colors flex items-center gap-2',
        isSelected && 'bg-accent/50'
      )}
      onClick={onClick}
    >
      <Badge variant="outline" className={cn('text-xs shrink-0', PRIORITY_STYLES[feature.priority])}>
        {feature.priority.toUpperCase()}
      </Badge>
      <span className="text-sm truncate flex-1">{feature.title}</span>
      <Badge variant="secondary" className={cn('text-xs shrink-0', STATUS_STYLES[feature.status])}>
        {feature.status.replace('_', ' ')}
      </Badge>
      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
    </button>
  );
});

/** Feature card (used in grid view) */
const FeatureCard = memo(function FeatureCard({ feature, isSelected, onClick }: {
  feature: RoadmapFeature;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'text-left p-3 border border-border rounded-lg hover:bg-accent/30 transition-colors',
        isSelected && 'bg-accent/50 ring-1 ring-primary'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Badge variant="outline" className={cn('text-xs', PRIORITY_STYLES[feature.priority])}>
          {feature.priority}
        </Badge>
        <Badge variant="secondary" className={cn('text-xs', STATUS_STYLES[feature.status])}>
          {feature.status.replace('_', ' ')}
        </Badge>
      </div>
      <h4 className="text-sm font-medium mb-1">{feature.title}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">{feature.description}</p>
    </button>
  );
});

/** Feature detail side panel */
function FeatureDetailPanel({ feature, onClose, onDelete, onStatusChange }: {
  feature: RoadmapFeature;
  onClose: () => void;
  onDelete: () => void;
  onStatusChange: (status: FeatureStatus) => void;
}) {
  const { t } = useTranslation(['roadmap']);

  return (
    <div className="w-80 border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-xs', PRIORITY_STYLES[feature.priority])}>
            {t(`roadmap:priority.${feature.priority}`)}
          </Badge>
          <Badge variant="secondary" className={cn('text-xs', STATUS_STYLES[feature.status])}>
            {t(`roadmap:status.${feature.status}`)}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <h3 className="text-base font-semibold">{feature.title}</h3>

          <p className="text-sm text-foreground/90">{feature.description}</p>

          {feature.rationale && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">{t('roadmap:rationale')}</h4>
              <p className="text-sm text-foreground/80">{feature.rationale}</p>
            </div>
          )}

          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">{t('roadmap:complexity')}:</span>
              <Badge variant="secondary" className="ml-1">{feature.complexity}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">{t('roadmap:impact')}:</span>
              <Badge variant="secondary" className="ml-1">{feature.impact}</Badge>
            </div>
          </div>

          {feature.userStories.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">{t('roadmap:userStories')}</h4>
              <ul className="space-y-1">
                {feature.userStories.map((story, i) => (
                  <li key={i} className="text-xs text-foreground/80 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-muted-foreground">
                    {story}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feature.acceptanceCriteria.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">{t('roadmap:acceptanceCriteria')}</h4>
              <ul className="space-y-1">
                {feature.acceptanceCriteria.map((criterion, i) => (
                  <li key={i} className="text-xs text-foreground/80 pl-3 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500">
                    {criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status change buttons */}
          <div className="border-t border-border pt-3">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Change status</h4>
            <div className="flex flex-wrap gap-1">
              {(['under_review', 'planned', 'in_progress', 'done'] as FeatureStatus[]).map(status => (
                <Button
                  key={status}
                  variant={feature.status === status ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onStatusChange(status)}
                  disabled={feature.status === status}
                >
                  {t(`roadmap:status.${status}`)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
