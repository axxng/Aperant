export type IdeationType =
  | 'code_improvements'
  | 'ui_ux_improvements'
  | 'documentation_gaps'
  | 'security_hardening'
  | 'performance_optimizations'
  | 'code_quality';

export type IdeaStatus = 'draft' | 'selected' | 'converted' | 'dismissed' | 'archived';

export type IdeationPhase = 'idle' | 'analyzing' | 'discovering' | 'generating' | 'finalizing' | 'complete' | 'error';

export interface Idea {
  id: string;
  type: IdeationType;
  title: string;
  description: string;
  rationale: string;
  status: IdeaStatus;
  category?: string;
  severity?: string;
  estimatedEffort?: string;
  affectedFiles?: string[];
  implementation?: string;
  taskId?: string;
  createdAt: string;
}

export interface IdeationSession {
  id: string;
  productId: string;
  ideas: Idea[];
  config: IdeationConfig;
  generatedAt: string;
  updatedAt: string;
}

export interface IdeationConfig {
  enabledTypes: IdeationType[];
  maxIdeasPerType: number;
}

export interface IdeationSummary {
  totalIdeas: number;
  byType: Partial<Record<IdeationType, number>>;
  byStatus: Partial<Record<IdeaStatus, number>>;
}
