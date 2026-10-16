import type { Material } from '@/features/materials';
import { formatQuantity, formatUnitCost } from '@/shared/format';
import { CatalogPickerSheet, type CatalogOption } from '@/shared/ui/catalog-picker-sheet';
import { StatusBadge } from '@/shared/ui/status-badge';

interface MaterialPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already narrowed to what can be picked: active materials not yet on the bill. */
  materials: readonly Material[];
  onPick: (material: Material) => void;
}

/** A material as a card of the picker: the photo, the name, what a unit costs and what is on the shelf. */
function toOption(material: Material): CatalogOption {
  return {
    id: material.id,
    name: material.name,
    imageUrl: material.imageUrl,
    // The seal is the API's flag, never a comparison made here.
    badges: material.lowStock ? <StatusBadge tone="warning">Estoque baixo</StatusBadge> : undefined,
    facts: [
      {
        label: 'Custo fracionado',
        value: (
          <span className="whitespace-nowrap">
            {formatUnitCost(material.unitCost, material.consumptionUnit)}
          </span>
        ),
        emphasis: true,
      },
      {
        label: 'Em estoque',
        value: <span className="whitespace-nowrap">{formatQuantity(material.stockQuantity)}</span>,
      },
    ],
  };
}

/**
 * Where a material is chosen for the bill of materials. Every figure is the
 * API's, and the unit cost is written per larger unit like everywhere else.
 */
export function MaterialPickerSheet({
  open,
  onOpenChange,
  materials,
  onPick,
}: MaterialPickerSheetProps) {
  return (
    <CatalogPickerSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar insumo à ficha"
      description="Escolha o insumo que cada unidade do produto consome."
      searchLabel="Buscar insumo"
      searchPlaceholder="Buscar insumo pelo nome…"
      listLabel="Insumos disponíveis"
      options={materials.map(toOption)}
      nothingToPick={{
        title: 'Nenhum insumo para adicionar',
        description:
          'Todos os insumos ativos já estão na ficha, ou ainda não há insumo cadastrado.',
      }}
      noun={{ one: 'insumo', many: 'insumos' }}
      onPick={(option) => {
        const picked = materials.find((material) => material.id === option.id);

        if (picked !== undefined) {
          onPick(picked);
        }
      }}
    />
  );
}
