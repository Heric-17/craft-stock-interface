import { useParams } from 'react-router';

/** Where the second step of an import will be: enough to see which purchase a link led to. */
export function ClassificationStandIn() {
  const { purchaseId } = useParams();

  return <p>Tela da classificação da compra {purchaseId}</p>;
}
