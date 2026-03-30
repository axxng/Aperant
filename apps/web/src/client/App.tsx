import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TooltipProvider } from './components/ui/tooltip';
import { Sidebar } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { CreateProductDialog } from './components/CreateProductDialog';
import { CreateTaskDialog } from './components/CreateTaskDialog';
import { TaskEditDialog } from './components/TaskEditDialog';
import { CreatePRDialog } from './components/CreatePRDialog';
import { GitHubIssuesList } from './components/GitHubIssuesList';
import { GitHubPRList } from './components/GitHubPRList';
import { Insights } from './components/Insights';
import { Roadmap } from './components/Roadmap';
import { Ideation } from './components/Ideation';
import { Changelog } from './components/Changelog';
import { Settings } from './components/Settings';
import { GitLabIssuesList } from './components/GitLabIssuesList';
import { GitLabMRList } from './components/GitLabMRList';
import { ProductSettings } from './components/ProductSettings';
import { useProductStore } from './stores/product-store';
import { useTaskStore } from './stores/task-store';
import type { Task } from '@shared/types/task';

export function App() {
  const { loadProducts, products, activeProductId } = useProductStore();
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [prTask, setPrTask] = useState<Task | null>(null);

  const handleTaskClick = useCallback((task: Task) => {
    setEditingTask(task);
  }, []);

  const handleCreatePR = useCallback((task: Task) => {
    setPrTask(task);
  }, []);

  const editProduct = editingTask ? products.find(p => p.id === editingTask.productId) : null;

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
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
            <Route
              path="/products/:productId/settings"
              element={<ProductSettings />}
            />
            <Route
              path="/products/:productId/issues"
              element={<GitHubIssuesList />}
            />
            <Route
              path="/products/:productId/prs"
              element={<GitHubPRList />}
            />
            <Route
              path="/products/:productId/roadmap"
              element={<Roadmap />}
            />
            <Route
              path="/products/:productId/ideation"
              element={<Ideation />}
            />
            <Route
              path="/products/:productId/changelog"
              element={<Changelog />}
            />
            <Route
              path="/products/:productId/gitlab-issues"
              element={<GitLabIssuesList />}
            />
            <Route
              path="/products/:productId/gitlab-mrs"
              element={<GitLabMRList />}
            />
            <Route
              path="/insights"
              element={<Insights />}
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
        onCreatePR={handleCreatePR}
      />
      <CreatePRDialog
        task={prTask}
        open={prTask !== null}
        onOpenChange={(open) => { if (!open) setPrTask(null); }}
      />
    </TooltipProvider>
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
