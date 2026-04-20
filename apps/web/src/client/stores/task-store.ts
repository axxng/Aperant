import { create } from 'zustand';
import { api } from '../lib/api-client';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskOrderState } from '@shared/types/task';

interface TaskState {
  tasks: Task[];
  taskOrder: TaskOrderState | null;
  isLoading: boolean;
  error: string | null;
  selectedTaskId: string | null;

  loadTasks: (productId?: string) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, input: UpdateTaskInput) => Promise<Task>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  setSelectedTask: (id: string | null) => void;
  loadTaskOrder: (scope: string) => Promise<void>;
  reorderTasks: (scope: string, status: TaskStatus, taskIds: string[]) => Promise<void>;
  getTasksByStatus: (status: TaskStatus) => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  taskOrder: null,
  isLoading: false,
  error: null,
  selectedTaskId: null,

  loadTasks: async (productId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await api.tasks.list(productId);
      set({ tasks, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createTask: async (input) => {
    const task = await api.tasks.create(input);
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: async (id, input) => {
    const currentTask = get().tasks.find((t) => t.id === id);
    const task = await api.tasks.update(id, { ...input, updatedAt: currentTask?.updatedAt });
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
    }));
    return task;
  },

  updateTaskStatus: async (id, status) => {
    const currentTask = get().tasks.find((t) => t.id === id);
    const task = await api.tasks.updateStatus(id, { status, updatedAt: currentTask?.updatedAt });
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
    }));
    return task;
  },

  deleteTask: async (id) => {
    await api.tasks.delete(id);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    }));
  },

  setSelectedTask: (id) => set({ selectedTaskId: id }),

  loadTaskOrder: async (scope) => {
    try {
      const taskOrder = await api.tasks.getOrder(scope);
      set({ taskOrder });
    } catch {
      // Ignore — ordering is optional
    }
  },

  reorderTasks: async (scope, status, taskIds) => {
    // Optimistic update
    set((state) => ({
      taskOrder: state.taskOrder
        ? { ...state.taskOrder, [status]: taskIds }
        : null,
    }));
    try {
      await api.tasks.setOrder(scope, status, taskIds);
    } catch {
      // Revert on failure by reloading
      const taskOrder = await api.tasks.getOrder(scope);
      set({ taskOrder });
    }
  },

  getTasksByStatus: (status) => {
    const { tasks, taskOrder } = get();
    const statusTasks = tasks.filter((t) => t.status === status);
    if (!taskOrder || !taskOrder[status]?.length) return statusTasks;

    // Sort by saved order
    const orderMap = new Map(taskOrder[status].map((id, idx) => [id, idx]));
    return statusTasks.sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIdx = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
  },
}));
