export function modifyBondData(
  price: { rub: number },
  bondType: string,
  isEditable: boolean
): () => void {
  price.rub = 1200;
  bondType = "fixed";
  isEditable = true;

  function printBondData() {
    return { price, bondType, isEditable };
  }

  return printBondData;
}

export function getResult() {
  const price = { rub: 1000 };
  let bondType = "floating";
  let isEditable: boolean | null = false;

  const printFn = modifyBondData(price, bondType, isEditable as boolean);

  const result1 = {
    price: { ...price },
    bondType,
    isEditable,
  };

  price.rub = 100;
  bondType = "amortization";
  isEditable = null;

  const closureResult = printFn();

  return {
    afterModify: result1,
    afterReassign: closureResult,
  };
}
