import React, { createContext, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { listTransactions } from "../../services/transactionsApi";

export type TxStatus = "DELIVERED" | "UNDELIVERED";

export type Transaction = {
  id: number;

  seller: string;
  sellerBrokerage: string;

  buyer: string;
  buyerBrokerage: string;

  product: string;
  rate: string;
  unitRate: string; // "per Quintal, Plus GST"
  tax: string; // "Plus VAT"
  quantity: string; // "29-30"
  unitQty: string; // "Tons"

  confirmDate: string;   // dd-MMM-yy
  deliveryTime: string;  // dd-MMM-yy
  deliveryPlace: string;
  payment: string;
  flag: string;

  status: TxStatus;

  // delivery details (only visible when user loads UNDELIVERED from Find)
  deliveryDate?: string;
  tankerNo?: string;
  billNo?: string;
  deliveryQty?: string;
  deliveryUnitQty?: string;
  amountRs?: string;
};

export type TxStore = {
  rows: Transaction[];
  setRows: React.Dispatch<React.SetStateAction<Transaction[]>>;

  selectedId: number | null;
  setSelectedId: React.Dispatch<React.SetStateAction<number | null>>;

  // controls whether Delivery Details panel is shown on entry screen
  showDeliveryPanel: boolean;
  setShowDeliveryPanel: React.Dispatch<React.SetStateAction<boolean>>;
};

export const TxContext = createContext<TxStore | null>(null);

const seed: Transaction[] = [
  {
    id: 387,
    seller: "SAMRAT INDUSTRIES, JUNAGADH",
    sellerBrokerage: "3000.00",
    buyer: "KANTI BROTHERS OILS P. Ltd., KURNOOL",
    buyerBrokerage: "3000.00",
    product: "G N OIL",
    rate: "12270.00",
    unitRate: "per Quintal, Plus GST",
    tax: "Plus VAT",
    quantity: "29-30",
    unitQty: "Tons",
    confirmDate: "26-Dec-24",
    deliveryTime: "02-Jan-25",
    deliveryPlace: "Sellers Factory",
    payment: "Cash",
    flag: "Nett Loose",
    status: "UNDELIVERED",
    deliveryDate: "26-Dec-24",
    tankerNo: "",
    billNo: "",
    deliveryQty: "0",
    deliveryUnitQty: "",
    amountRs: "0.00",
  },
  {
    id: 388,
    seller: "ABC SELLER",
    sellerBrokerage: "2500.00",
    buyer: "XYZ BUYER",
    buyerBrokerage: "2500.00",
    product: "SUNFLOWER OIL",
    rate: "11800.00",
    unitRate: "per Quintal, Plus GST",
    tax: "Plus VAT",
    quantity: "10",
    unitQty: "Tons",
    confirmDate: "02-Feb-26",
    deliveryTime: "02-Feb-26",
    deliveryPlace: "Warehouse",
    payment: "Cash",
    flag: "Standard",
    status: "DELIVERED",
  },
];

  export default function TransactionsShell() {
        const [rows, setRows] = useState<Transaction[]>([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);

        const [selectedId, setSelectedId] = useState<number | null>(null);
        const [showDeliveryPanel, setShowDeliveryPanel] = useState(false);

        const value = useMemo<TxStore>(
            () => ({ rows, setRows, selectedId, setSelectedId, showDeliveryPanel, setShowDeliveryPanel }),
            [rows, selectedId, showDeliveryPanel]
        );

        React.useEffect(() => {
        let alive = true;

        (async () => {
            try {
            setLoading(true);
            const data = await listTransactions(); //  GET from DB
            if (!alive) return;
            setRows(data ?? []);
            } catch (e) {
            if (!alive) return;
            setError((e as Error).message);
            setRows([]);
            } finally {
            if (!alive) return;
            setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
        }, []);


  return (
    <TxContext.Provider value={value}>
      <Outlet />
    </TxContext.Provider>
  );
}


