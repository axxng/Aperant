import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getRoadmap, createRoadmap, updateRoadmap, deleteRoadmap } from '../db/roadmaps.js';
import { runAgentSession } from '../ai/session/runner.js';
import { resolveConfig } from '../config-resolver.js';
import type { CoreMessage } from 'ai';

export const roadmapRoutes = Router();

function setupSSE(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  return {
    send(event: string, data: unknown) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); },
    close() { res.end(); },
  };
}

const ROADMAP_SYSTEM_PROMPT = `You are a strategic product manager creating a roadmap. Analyze the product context and generate a structured roadmap.

Output ONLY valid JSON in this exact format:
{
  "vision": "One-line product vision",
  "targetAudience": "Primary target audience description",
  "phases": [
    {
      "id": "phase-1",
      "name": "Phase name",
      "description": "Phase description",
      "order": 1,
      "status": "planned",
      "featureIds": ["feat-1", "feat-2"],
      "milestones": [{"id": "ms-1", "title": "Milestone", "status": "planned"}]
    }
  ],
  "features": [
    {
      "id": "feat-1",
      "title": "Feature title",
      "description": "What this feature does",
      "rationale": "Why this matters",
      "priority": "must|should|could|wont",
      "complexity": "low|medium|high",
      "impact": "low|medium|high",
      "phaseId": "phase-1",
      "status": "under_review",
      "acceptanceCriteria": ["Criterion 1"],
      "userStories": ["As a user, I want..."],
      "dependencies": []
    }
  ]
}

Generate 8-15 features across 3-4 phases. Use MoSCoW prioritization. Be specific and actionable.`;

/** GET /:productId — Get roadmap for a product */
roadmapRoutes.get('/:productId', (req: Request, res: Response) => {
  const roadmap = getRoadmap(req.params.productId);
  if (!roadmap) { res.json(null); return; }
  res.json({
    id: roadmap.id,
    productId: roadmap.product_id,
    vision: roadmap.vision,
    targetAudience: roadmap.target_audience,
    phases: JSON.parse(roadmap.phases),
    features: JSON.parse(roadmap.features),
    createdAt: roadmap.created_at,
    updatedAt: roadmap.updated_at,
  });
});

/** PATCH /:id — Update roadmap (features, phases) */
roadmapRoutes.patch('/:id', (req: Request, res: Response) => {
  const updates: any = {};
  if (req.body.vision !== undefined) updates.vision = req.body.vision;
  if (req.body.targetAudience !== undefined) updates.target_audience = req.body.targetAudience;
  if (req.body.phases !== undefined) updates.phases = JSON.stringify(req.body.phases);
  if (req.body.features !== undefined) updates.features = JSON.stringify(req.body.features);
  updateRoadmap(req.params.id, updates);
  res.json({ success: true });
});

/** DELETE /:id — Delete a roadmap */
roadmapRoutes.delete('/:id', (req: Request, res: Response) => {
  deleteRoadmap(req.params.id);
  res.json({ success: true });
});

/** POST /:productId/generate — AI-generate a roadmap via SSE */
roadmapRoutes.post('/:productId/generate', async (req: Request, res: Response) => {
  if (!resolveConfig('anthropicApiKey', 'ANTHROPIC_API_KEY')) {
    res.status(503).json({ error: 'AI provider not configured. Set ANTHROPIC_API_KEY or configure it in Settings.' });
    return;
  }

  const productId = req.params.productId;
  const productName = req.body?.productName ?? 'the product';
  const productDescription = req.body?.productDescription ?? '';

  const sse = setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  sse.send('progress', { phase: 'analyzing', progress: 10, message: 'Analyzing product...' });

  const userMessage = `Generate a strategic roadmap for this product:

**Product:** ${productName}
${productDescription ? `**Description:** ${productDescription}` : ''}

Create a phased roadmap with features prioritized by business value. Output only the JSON structure as specified.`;

  const messages: CoreMessage[] = [{ role: 'user', content: userMessage }];
  let fullText = '';

  try {
    sse.send('progress', { phase: 'generating', progress: 30, message: 'Generating roadmap...' });

    const result = await runAgentSession(
      {
        agentType: 'roadmap',
        systemPrompt: ROADMAP_SYSTEM_PROMPT,
        messages,
        cwd: process.cwd(),
        abortSignal: abortController.signal,
      },
      {
        onEvent: (event) => {
          if (event.type === 'text-delta') {
            const { text } = event.data as { text: string };
            fullText += text;
            sse.send('text-delta', { text });
          } else if (event.type === 'step-finish') {
            sse.send('progress', { phase: 'generating', progress: 60, message: 'Structuring roadmap...' });
          }
        },
      },
    );

    // Try to parse the JSON from the response
    let roadmapData: any = null;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, fullText];
      roadmapData = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      sse.send('error', { error: 'Failed to parse roadmap JSON from AI response' });
      sse.close();
      return;
    }

    // Save to database
    const saved = createRoadmap(productId, {
      vision: roadmapData.vision ?? '',
      targetAudience: roadmapData.targetAudience ?? '',
      phases: JSON.stringify(roadmapData.phases ?? []),
      features: JSON.stringify(roadmapData.features ?? []),
    });

    sse.send('progress', { phase: 'complete', progress: 100, message: 'Roadmap generated!' });
    sse.send('roadmap-result', {
      id: saved.id,
      productId: saved.product_id,
      vision: roadmapData.vision,
      targetAudience: roadmapData.targetAudience,
      phases: roadmapData.phases,
      features: roadmapData.features,
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    });
  } catch (err: any) {
    sse.send('error', { error: err.message ?? 'Generation failed' });
  } finally {
    sse.close();
  }
});
