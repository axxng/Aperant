export type FeaturePriority = 'must' | 'should' | 'could' | 'wont';
export type FeatureStatus = 'under_review' | 'planned' | 'in_progress' | 'done';
export type PhaseStatus = 'planned' | 'in_progress' | 'completed';

export interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  rationale: string;
  priority: FeaturePriority;
  complexity: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  phaseId: string;
  status: FeatureStatus;
  acceptanceCriteria: string[];
  userStories: string[];
  dependencies: string[];
  linkedTaskId?: string;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  status: 'planned' | 'achieved';
}

export interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  status: PhaseStatus;
  featureIds: string[];
  milestones: RoadmapMilestone[];
}

export interface Roadmap {
  id: string;
  productId: string;
  vision: string;
  targetAudience: string;
  phases: RoadmapPhase[];
  features: RoadmapFeature[];
  createdAt: string;
  updatedAt: string;
}
