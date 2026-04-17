/**
 * Facade hook for backward compatibility.
 * Re-exports types and composes usePropertyCRUD + usePropertyBulkOps.
 */
import { useDemo } from '@/contexts/DemoContext';
import { useToast } from '@/hooks/use-toast';
import { usePropertyCRUD } from './usePropertyCRUD';
import { usePropertyBulkOps } from './usePropertyBulkOps';

// Re-export all types for backward compatibility
export type { Property, PropertyType, PropertyImage, PropertyWithDetails, PropertyFormData, ImageData, OwnerData } from './usePropertyCRUD';

export function useProperties() {
  const { isDemoMode, demoData } = useDemo();
  const { toast } = useToast();

  // Demo mode: return mock data
  if (isDemoMode) {
    const demoProperties = demoData.properties as any[];
    const demoMutate = () => {
      toast({ title: 'Modo Demonstração', description: 'Os dados não serão salvos neste modo.' });
    };
    return {
      properties: demoProperties,
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve({ data: demoProperties, error: null }),
      createProperty: async () => { demoMutate(); return demoProperties[0]; },
      updateProperty: async () => { demoMutate(); return demoProperties[0]; },
      deleteProperty: async () => { demoMutate(); },
      bulkDeleteProperties: async () => { demoMutate(); },
      bulkInactivateProperties: async () => { demoMutate(); },
      publishToMarketplace: async () => { demoMutate(); },
      bulkPublishToMarketplace: async () => { demoMutate(); },
      bulkHideFromMarketplace: async () => { demoMutate(); },
      hideFromMarketplace: async () => { demoMutate(); },
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isBulkDeleting: false,
      isBulkInactivating: false,
      isPublishing: false,
      isBulkPublishing: false,
      isBulkHiding: false,
    };
  }

  const crud = usePropertyCRUD();
  const bulk = usePropertyBulkOps();

  return { ...crud, ...bulk };
}
