import React, { memo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProductStore } from '../stores/product-store';
import { cn } from '../lib/utils';
import { LayoutDashboard, Plus, Settings, RefreshCw, LogOut, Inbox } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';

interface SidebarProps {
  onAddProduct: () => void;
}

export const Sidebar = memo(function Sidebar({ onAddProduct }: SidebarProps) {
  const { t } = useTranslation(['navigation', 'common', 'auth']);
  const { products, activeProductId, setActiveProduct, syncProduct } = useProductStore();
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const handleSync = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSyncingId(productId);
    try {
      await syncProduct(productId);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-card transition-all duration-200',
        isCollapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        {!isCollapsed && (
          <span className="text-sm font-semibold text-foreground">{t('common:appName')}</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <LayoutDashboard className="h-4 w-4" />
        </Button>
      </div>

      {/* All Products (consolidated) */}
      <NavLink
        to="/"
        onClick={() => setActiveProduct(null)}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/50',
            isActive && 'bg-accent text-accent-foreground font-medium'
          )
        }
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        {!isCollapsed && <span>{t('common:allProducts')}</span>}
      </NavLink>

      {/* /issues — All Issues unified view (D-01, D-02: Inbox icon, below All Products) */}
      <NavLink
        to="/issues"
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/50',
            isActive && 'bg-accent text-accent-foreground font-medium'
          )
        }
      >
        <Inbox className="h-4 w-4 shrink-0" />
        {!isCollapsed && <span>{t('navigation:items.allIssues')}</span>}
      </NavLink>

      {/* Product list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('common:products')}
            </div>
          )}
          {products.map((product) => (
            <React.Fragment key={product.id}>
              <NavLink
                to={`/products/${product.id}`}
                onClick={() => setActiveProduct(product.id)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/50 group',
                    isActive && 'bg-accent text-accent-foreground font-medium'
                  )
                }
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: product.color }}
                />
                {!isCollapsed && (
                  <>
                    <span className="truncate flex-1">{product.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleSync(e, product.id)}
                      disabled={syncingId === product.id}
                    >
                      <RefreshCw className={cn('h-3 w-3', syncingId === product.id && 'animate-spin')} />
                    </Button>
                  </>
                )}
              </NavLink>
            </React.Fragment>
          ))}
        </div>
      </ScrollArea>

      {/* User info */}
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between">
          <div className="truncate text-xs text-muted-foreground">{!isCollapsed && user?.email}</div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={logout} title={t('auth:logout')}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Settings + Add Product */}
      <div className="border-t border-border p-2 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/50 rounded-md',
              isActive && 'bg-accent text-accent-foreground font-medium'
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>{t('navigation:items.settings')}</span>}
        </NavLink>
        <Button
          variant="outline"
          size={isCollapsed ? 'icon' : 'sm'}
          className={cn('w-full', isCollapsed && 'h-8 w-8')}
          onClick={onAddProduct}
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span className="ml-1">{t('common:addProduct')}</span>}
        </Button>
      </div>
    </aside>
  );
});
