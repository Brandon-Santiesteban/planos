import { useId, useState } from 'react';
import { formatMetres } from '../model/units';
import Icon from '../ui/Icon';
import { CATALOG, CATEGORIES, type CatalogItem, searchCatalog } from './catalog';
import { usePlacement } from './placeTool';
import { FurnitureSymbol } from './symbols';

export const sizeLabel = (w: number, d: number) => `${formatMetres(w).replace(' m', '')} × ${formatMetres(d)}`;

/**
 * Picture of a catalog piece: its 3D model in colour (public/muebles, made by scripts/miniaturas-muebles.mjs), or
 * its top view while there is no picture.
 */
export function Thumb({ item, size = 44 }: { item: CatalogItem; size?: number }) {
  const [missing, setMissing] = useState(false);
  const span = Math.max(item.width, item.depth) * 1.25;
  if (!missing) {
    return <img className="mueble-foto" src={`/muebles/${item.id}.png`} width={size} height={size} alt="" loading="lazy" onError={() => setMissing(true)} />;
  }
  return (
    <svg className="mueble-miniatura" width={size} height={size} viewBox={`${-span / 2} ${-span / 2} ${span} ${span}`} aria-hidden="true">
      <FurnitureSymbol item={item} w={item.width} d={item.depth} />
    </svg>
  );
}

/** Sidebar of the Muebles tool: search, category chips and the pieces to place. */
export default function CatalogPanel() {
  const { itemId, category, query, rotation } = usePlacement();
  const searchId = useId();
  const items = searchCatalog(query, category);
  const inQuery = (c: (typeof CATEGORIES)[number] | null) => searchCatalog(query, c).length;
  const chosen = CATALOG.find((i) => i.id === itemId);

  return (
    <section className="tarjeta catalogo">
      <h2>Muebles</h2>
      <div className="field">
        <label htmlFor={searchId}>Buscar</label>
        <div className="buscador">
          <Icon name="search" size={16} />
          <input
            id={searchId}
            value={query}
            placeholder="Cama, silla, nevera…"
            onChange={(e) => usePlacement.setState({ query: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Escape') usePlacement.setState({ query: '' }); }}
          />
        </div>
      </div>
      <div className="chips" role="group" aria-label="Categorías">
        {[null, ...CATEGORIES].map((c) => (
          <button
            key={c ?? 'todos'}
            className={`chip${category === c ? ' activa' : ''}`}
            aria-pressed={category === c}
            onClick={() => usePlacement.setState({ category: c })}
          >
            {c ?? 'Todos'}<span className="conteo">{inQuery(c)}</span>
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="hint">Nada coincide con tu búsqueda</p>
      ) : (
        <div className="muebles-lista">
          {items.map((i) => (
            <button
              key={i.id}
              className={`tarjeta-mueble${itemId === i.id ? ' activa' : ''}`}
              aria-pressed={itemId === i.id}
              data-testid={`mueble-${i.id}`}
              onClick={() => usePlacement.setState({ itemId: itemId === i.id ? null : i.id, rotation: 0 })}
            >
              <Thumb item={i} size={84} />
              <span className="nombre">{i.name}</span>
              <span className="medida">{sizeLabel(i.width, i.depth)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="hint parrafo" style={{ marginTop: 12 }}>
        {chosen
          ? `Haz clic en el plano para colocar: ${chosen.name.toLowerCase()}${rotation ? ` (girado ${rotation}°)` : ''}. R lo gira. Cerca de un muro se pega a él de espaldas. Esc termina.`
          : 'Elige un mueble y haz clic en el plano para colocarlo. Después lo mueves, giras o cambias de medidas con Seleccionar (V).'}
      </p>
    </section>
  );
}
