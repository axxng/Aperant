import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from './components/ui/tooltip';
import { Sidebar } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { CreateProductDialog } from './components/CreateProductDialog';
import { CreateTaskDialog } from './components/CreateTaskDialog';
import { TaskEditDialog } from './components/TaskEditDialog';
import { Settings } from './components/Settings';
import { ProductSettings } from './components/ProductSettings';
import { ToastContainer } from './components/ToastContainer';
import { DevModeBanner } from './components/DevModeBanner';
import { LoginPage } from './components/LoginPage';
import { IssuesView } from './components/IssuesView'; // IssuesView — created in plan 02-07
import { AllIssuesView } from './components/AllIssuesView'; // AllIssuesView — Phase 4
import { useProductStore } from './stores/product-store';
import { useTaskStore } from './stores/task-store';
import { useAuthStore } from './stores/auth-store';
import { useSyncEvents } from './hooks/useSyncEvents';
import type { Task } from '@shared/types/task';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const { token, user, checkSession } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('token');
    if (oauthToken) {
      // OAuth callback redirect — pick up JWT from ?token= query param, clean URL
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${oauthToken}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((user) => {
          if (user) useAuthStore.getState().setAuth(oauthToken, user);
          window.history.replaceState({}, '', '/');
        })
        .catch(() => {})
        .finally(() => setAuthChecked(true));
    } else if (token) {
      checkSession().finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authChecked) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">...</p></div>;
  }

  if (!token || !user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { loadProducts, products, activeProductId } = useProductStore();
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const handleTaskClick = useCallback((task: Task) => {
    setEditingTask(task);
  }, []);

  const editProduct = editingTask ? products.find(p => p.id === editingTask.productId) : null;

  // Real-time sync events + toast notifications
  useSyncEvents();

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar onAddProduct={() => setShowCreateProduct(true)} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={<ConsolidatedView onNewTask={() => setShowCreateTask(true)} onTaskClick={handleTaskClick} />}
            />
            <Route
              path="/products/:productId"
              element={<ProductView onNewTask={() => setShowCreateTask(true)} onTaskClick={handleTaskClick} />}
            />
            {/* Issues browser — Phase 2 */}
            <Route
              path="/products/:productId/issues"
              element={<IssuesView />}
            />
            {/* All Issues unified view — Phase 4 (CROSS-01) */}
            <Route
              path="/issues"
              element={<AllIssuesView />}
            />
            <Route
              path="/products/:productId/settings"
              element={<ProductSettings />}
            />
            <Route
              path="/settings"
              element={<Settings />}
            />
          </Routes>
        </main>
      </div>

      <CreateProductDialog open={showCreateProduct} onOpenChange={setShowCreateProduct} />
      <CreateTaskDialog open={showCreateTask} onOpenChange={setShowCreateTask} />
      <TaskEditDialog
        task={editingTask}
        open={editingTask !== null}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        productName={editProduct?.name}
        productColor={editProduct?.color}
      />
      <ToastContainer />
      <DevModeBanner />
    </TooltipProvider>
    </QueryClientProvider>
  );
}

/** Consolidated backlog — all tasks across all products */
function ConsolidatedView({ onNewTask, onTaskClick }: { onNewTask: () => void; onTaskClick: (task: Task) => void }) {
  const { tasks, loadTasks, isLoading } = useTaskStore();
  const { setActiveProduct } = useProductStore();

  useEffect(() => {
    setActiveProduct(null);
    loadTasks(); // No productId = all tasks
  }, [loadTasks, setActiveProduct]);

  return (
    <KanbanBoard
      tasks={tasks}
      onTaskClick={onTaskClick}
      onNewTaskClick={onNewTask}
      onRefresh={() => loadTasks()}
      isRefreshing={isLoading}
    />
  );
}

/** Per-product backlog — tasks for a single product */
function ProductView({ onNewTask, onTaskClick }: { onNewTask: () => void; onTaskClick: (task: Task) => void }) {
  const { productId } = useParams<{ productId: string }>();
  const { tasks, loadTasks, isLoading } = useTaskStore();
  const { setActiveProduct } = useProductStore();

  useEffect(() => {
    if (productId) {
      setActiveProduct(productId);
      loadTasks(productId);
    }
  }, [productId, loadTasks, setActiveProduct]);

  return (
    <KanbanBoard
      tasks={tasks}
      onTaskClick={onTaskClick}
      onNewTaskClick={onNewTask}
      onRefresh={() => productId && loadTasks(productId)}
      isRefreshing={isLoading}
    />
  );
}
