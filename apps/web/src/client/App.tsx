import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TooltipProvider } from './components/ui/tooltip';
import { Sidebar } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { CreateProductDialog } from './components/CreateProductDialog';
import { CreateTaskDialog } from './components/CreateTaskDialog';
import { ProductSettings } from './components/ProductSettings';
import { useProductStore } from './stores/product-store';
import { useTaskStore } from './stores/task-store';

export function App() {
  const { loadProducts } = useProductStore();
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

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
              element={<ConsolidatedView onNewTask={() => setShowCreateTask(true)} />}
            />
            <Route
              path="/products/:productId"
              element={<ProductView onNewTask={() => setShowCreateTask(true)} />}
            />
            <Route
              path="/products/:productId/settings"
              element={<ProductSettings />}
            />
          </Routes>
        </main>
      </div>

      <CreateProductDialog open={showCreateProduct} onOpenChange={setShowCreateProduct} />
      <CreateTaskDialog open={showCreateTask} onOpenChange={setShowCreateTask} />
    </TooltipProvider>
  );
}

/** Consolidated backlog — all tasks across all products */
function ConsolidatedView({ onNewTask }: { onNewTask: () => void }) {
  const { tasks, loadTasks, isLoading } = useTaskStore();
  const { setActiveProduct } = useProductStore();

  useEffect(() => {
    setActiveProduct(null);
    loadTasks(); // No productId = all tasks
  }, [loadTasks, setActiveProduct]);

  return (
    <KanbanBoard
      tasks={tasks}
      onTaskClick={() => {}}
      onNewTaskClick={onNewTask}
      onRefresh={() => loadTasks()}
      isRefreshing={isLoading}
    />
  );
}

/** Per-product backlog — tasks for a single product */
function ProductView({ onNewTask }: { onNewTask: () => void }) {
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
      onTaskClick={() => {}}
      onNewTaskClick={onNewTask}
      onRefresh={() => productId && loadTasks(productId)}
      isRefreshing={isLoading}
    />
  );
}
