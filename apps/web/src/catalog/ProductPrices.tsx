export function formatMoney(value:string|null,quantity=1){
  if(value===null)return 'Não informado';
  const [whole,fraction='']=value.split('.');
  const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  const total=cents*BigInt(quantity);
  return `R$\u00a0${(total/100n).toLocaleString('pt-BR')},${(total%100n).toString().padStart(2,'0')}`;
}

export function ProductPrices({salePrice,cost,showCost}:{salePrice:string|null;cost:string|null;showCost:boolean}){
  return <div className="product-prices"><div><span>Preço de venda</span><strong>{formatMoney(salePrice)}</strong></div>{showCost&&<div><span>Custo</span><strong>{formatMoney(cost)}</strong></div>}</div>;
}
