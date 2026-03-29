import React, { memo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProductStore } from '../stores/product-store';
import { cn } from '../lib/utils';
import { LayoutDashboard, Package, Plus, Settings, RefreshCw, CircleDot, GitPullRequest, Lightbulb, Map, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';

interface SidebarProps {
  onAddProduct: () => void;
}

export const Sidebar = memo(function Sidebar({ onAddProduct }: SidebarProps) {
  const { t } = useTranslation(['navigation', 'common']);
  const { products, activeProductId, setActiveProduct, syncProduct } = useProductStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const navigate = useNavigate();

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

      {/* Insights */}
      <NavLink
        to="/insights"
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/50',
            isActive && 'bg-accent text-accent-foreground font-medium'
          )
        }
      >
        <Lightbulb className="h-4 w-4 shrink-0" />
        {!isCollapsed && <span>{t('navigation:items.insights')}</span>}
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
              {!isCollapsed && activeProductId === product.id && (
                <>
                  <NavLink
                    to={`/products/${product.id}/issues`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs transition-colors hover:bg-accent/50',
                        isActive && 'bg-accent text-accent-foreground font-medium'
                      )
                    }
                  >
                    <CircleDot className="h-3 w-3 shrink-0" />
                    <span>{t('navigation:items.issues')}</span>
                  </NavLink>
                  <NavLink
                    to={`/products/${product.id}/prs`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs transition-colors hover:bg-accent/50',
                        isActive && 'bg-accent text-accent-foreground font-medium'
                      )
                    }
                  >
                    <GitPullRequest className="h-3 w-3 shrink-0" />
                    <span>{t('navigation:items.prs')}</span>
                  </NavLink>
                  <NavLink
                    to={`/products/${product.id}/roadmap`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs transition-colors hover:bg-accent/50',
                        isActive && 'bg-accent text-accent-foreground font-medium'
                      )
                    }
                  >
                    <Map className="h-3 w-3 shrink-0" />
                    <span>{t('navigation:items.roadmap')}</span>
                  </NavLink>
                  <NavLink
                    to={`/products/${product.id}/ideation`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs transition-colors hover:bg-accent/50',
                        isActive && 'bg-accent text-accent-foreground font-medium'
                      )
                    }
                  >
                    <Zap className="h-3 w-3 shrink-0" />
                    <span>{t('navigation:items.ideation')}</span>
                  </NavLink>
                </>
              )}
            </React.Fragment>
          ))}
        </div>
      </ScrollArea>

      {/* Add Product button */}
      <div className="border-t border-border p-2">
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
