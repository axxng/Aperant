import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProductStore } from '../stores/product-store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { PRODUCT_COLORS } from '../../../shared/types/product';
import { cn } from '../lib/utils';
import { ArrowLeft, Trash2 } from 'lucide-react';

export function ProductSettings() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { products, updateProduct, deleteProduct } = useProductStore();
  const product = products.find((p) => p.id === productId);

  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [color, setColor] = useState(product?.color || PRODUCT_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setColor(product.color);
    }
  }, [product]);

  if (!product) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Product not found
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProduct(product.id, { name, description, color });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete "${product.name}"? This will remove all tasks associated with this product.`)) {
      await deleteProduct(product.id);
      navigate('/');
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(`/products/${productId}`)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to board
      </Button>

      <h1 className="text-xl font-semibold mb-6">Product Settings</h1>

      <div className="space-y-6">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex gap-2">
            {PRODUCT_COLORS.map((c) => (
              <button
                key={c}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-all',
                  color === c ? 'border-foreground scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Sources</Label>
          <pre className="text-xs bg-muted rounded-md p-3 overflow-auto">
            {JSON.stringify(product.sources, null, 2)}
          </pre>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete Product
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
