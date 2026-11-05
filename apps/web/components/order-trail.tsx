// An order's trail from Arkiv: the edges that carry its order id, read through
// Graph Arkiv's GraphQL `order(id)` (planning/SPEC/ARKIV_GRAPH.md §5). It is wired
// to the real schema when M7b lands; until then the page says so.

export function OrderTrail({ orderId }: { orderId: string }) {
  return (
    <div className="waiting" data-order={orderId}>
      <span aria-hidden="true">◌</span>
      <p>
        This order’s records are read from Arkiv through GraphQL, which comes with <strong>M7b GraphQL and explain</strong>.
      </p>
    </div>
  );
}
