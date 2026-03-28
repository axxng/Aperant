import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useInsightsStore } from '../stores/insights-store';
import type { ChatMessage } from '../stores/insights-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import {
  Plus, Trash2, Edit3, Send, Loader2, MessageSquare, User, Bot,
  FileCode, Search, FolderOpen, X, Check,
} from 'lucide-react';

export function Insights() {
  const { t } = useTranslation(['insights', 'common']);
  const {
    sessions, currentSession, isLoadingSessions, isLoadingSession,
    phase, streamingText, currentTool, error,
    loadSessions, createSession, selectSession, deleteSession, renameSession,
    setPhase, appendStreamingText, setCurrentTool, finalizeMessage,
    addUserMessage, setError, reset,
  } = useInsightsStore();

  const [input, setInput] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages.length, streamingText]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || phase === 'streaming' || phase === 'thinking') return;
    if (!currentSession) {
      const session = await createSession();
      // Will continue after session is created
      handleSendToSession(session.id, input.trim());
      return;
    }
    handleSendToSession(currentSession.id, input.trim());
  }, [input, phase, currentSession, createSession]);

  const handleSendToSession = useCallback(async (sessionId: string, content: string) => {
    addUserMessage(content);
    setInput('');
    setPhase('thinking');

    try {
      const response = await fetch(`/api/insights/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        setError(`Request failed: HTTP ${response.status}`);
        return;
      }

      setPhase('streaming');
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      const toolsUsed: Array<{ name: string; input?: string }> = [];

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
              if (eventType === 'text-delta') {
                fullText += data.text;
                appendStreamingText(data.text);
                setCurrentTool(null);
              } else if (eventType === 'tool-call') {
                setCurrentTool({ name: data.name, input: data.input });
                toolsUsed.push({ name: data.name, input: data.input });
              } else if (eventType === 'tool-result') {
                setCurrentTool(null);
              } else if (eventType === 'done') {
                finalizeMessage({
                  id: data.messageId ?? crypto.randomUUID(),
                  role: 'assistant',
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
                });
              } else if (eventType === 'error') {
                setError(data.error);
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
  }, [addUserMessage, setPhase, appendStreamingText, setCurrentTool, finalizeMessage, setError]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNewSession = useCallback(async () => {
    await createSession();
  }, [createSession]);

  const handleRename = useCallback((id: string, currentTitle: string | null) => {
    setEditingSessionId(id);
    setEditTitle(currentTitle ?? '');
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (editingSessionId && editTitle.trim()) {
      await renameSession(editingSessionId, editTitle.trim());
    }
    setEditingSessionId(null);
  }, [editingSessionId, editTitle, renameSession]);

  const isStreaming = phase === 'streaming' || phase === 'thinking';

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{t('insights:sessions')}</h2>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNewSession}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {isLoadingSessions ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t('insights:noSessions')}</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent/30 transition-colors',
                  currentSession?.id === session.id && 'bg-accent/50'
                )}
                onClick={() => selectSession(session.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {editingSessionId === session.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      className="flex-1 text-xs bg-background border border-input rounded px-1 py-0.5"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button onClick={(e) => { e.stopPropagation(); handleRenameSubmit(); }}>
                      <Check className="h-3 w-3 text-green-500" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="truncate flex-1 text-xs">
                      {session.title ?? 'New chat'}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleRename(session.id, session.title); }}>
                        <Edit3 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}>
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!currentSession && !isLoadingSession ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            {t('insights:selectSession')}
          </div>
        ) : isLoadingSession ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {currentSession && currentSession.messages.length === 0 && !streamingText ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {t('insights:noMessages')}
                </div>
              ) : (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {currentSession?.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  {/* Streaming message */}
                  {(streamingText || phase === 'thinking') && (
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {currentTool && (
                          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{t('insights:usingTool', { tool: `${currentTool.name}${currentTool.input ? `: ${currentTool.input}` : ''}` })}</span>
                          </div>
                        )}
                        {streamingText ? (
                          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                            {streamingText}
                            <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                          </pre>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t('insights:thinking')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
                      {error}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input area */}
            <div className="border-t border-border p-4">
              <div className="max-w-3xl mx-auto flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('insights:inputPlaceholder')}
                  disabled={isStreaming}
                  rows={1}
                  className={cn(
                    'flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    'min-h-[40px] max-h-[200px]'
                  )}
                  style={{ height: 'auto', minHeight: '40px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  size="sm"
                  className="self-end"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Single message bubble */
const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation(['insights']);
  const isUser = message.role === 'user';

  return (
    <div className="flex gap-3">
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        isUser ? 'bg-muted' : 'bg-primary/10'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {message.toolsUsed.map((tool, i) => (
              <Badge key={i} variant="secondary" className="text-xs gap-1">
                {tool.name === 'Read' && <FileCode className="h-3 w-3" />}
                {tool.name === 'Glob' && <FolderOpen className="h-3 w-3" />}
                {tool.name === 'Grep' && <Search className="h-3 w-3" />}
                {tool.input ? `${tool.name}: ${tool.input}` : tool.name}
              </Badge>
            ))}
          </div>
        )}
        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
          {message.content}
        </pre>
      </div>
    </div>
  );
});
