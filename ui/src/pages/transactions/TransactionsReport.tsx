import React from "react";
import { useNavigate, useParams } from "react-router-dom";


type Client = {
  id?: number;
  name?: string;
  address?: string;
  cityState?: string;
  pinNo?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  gstNo?: string;     // used as TIN in old UI
  fssaiNo?: string;   // optional
};

type Tx = any;

function digitsOnly(s: any) {
  return (s ?? "").toString().replace(/[^\d]/g, "");
}

const BROKER = {
  name: "ANIL.A.SHAH",
  line1: "Edible Oils, Seeds & Cake Brokers",
  addr1: "Post Box No.18, 68/39c, Mahaveer Colony",
  addr2: "Near Urban Bank",
  city: "Kurnool,(A.P) - 518001",
  phone: "Phone: 08518-244195",
  mobile: "Mobile: 9848076195, 9440244284",
  email: "Email : anilshahknl@gmail.com",
  faithfully: "ANIL A SHAH",
};

function buildConfirmationNote(tx: Tx, seller: Client, buyer: Client) {
  const lines: string[] = [];

  // ✅ BROKER (ALWAYS CONSTANT)
  lines.push(BROKER.name);
  lines.push(BROKER.line1);
  lines.push(BROKER.addr1);
  lines.push(BROKER.addr2);
  lines.push(BROKER.city);
  lines.push(`${BROKER.phone}   ${BROKER.mobile}`);
  lines.push(BROKER.email);

  lines.push("");
  lines.push("TO,"); // ✅ TO = SELLER
  lines.push(`${seller?.name || "-"}`);
  if (seller?.address) lines.push(`${seller.address}`);
 // if (seller?.cityState) lines.push(`${seller.cityState}`);
//  if (seller?.pinNo) lines.push(`PIN : ${seller.pinNo}`);
  if (seller?.phone || seller?.mobile) lines.push(`Phone: ${seller.phone || ""}  Mobile: ${seller.mobile || ""}`);
  if (seller?.email) lines.push(`Email: ${seller.email}`);

  lines.push("");
  lines.push("CONFIRMATION NOTE");
  lines.push("");
  lines.push(`Date: ${tx?.confirm_date || tx?.confirmDate || "-"}`);
  lines.push(`Transaction No: ${tx?.transaction_id || "-"}`);
  lines.push("");

  lines.push("Dear Sirs,");
  lines.push("");

  // ✅ BUYER DETAILS AS “To Whom (Buyer)”
  lines.push(`To Whom (Buyer): ${buyer?.name || "-"}`);
  if (buyer?.address) lines.push(`${buyer.address}`);
  //if (buyer?.cityState) lines.push(`${buyer.cityState}`);
 // if (buyer?.pinNo) lines.push(`PIN : ${buyer.pinNo}`);
  if (buyer?.phone || buyer?.mobile) lines.push(`Phone: ${buyer.phone || ""}  Mobile: ${buyer.mobile || ""}`);

  lines.push("");
  lines.push(`PLACE OF DELIVERY : ${tx?.delivery_place || tx?.deliveryPlace || "-"}`);
  lines.push(`QUANTITY : ${tx?.quantity || "-"} ${tx?.unit_qty || tx?.unitQty || ""}`);
  lines.push(`PRICE : ${tx?.rate || "-"} per ${tx?.unit_rate || tx?.unitRate || ""} (${tx?.tax || "Plus VAT"})`);
  lines.push(`TIME OF DELIVERY : ${tx?.delivery_date || tx?.deliveryDate || "-"}`);
  lines.push(`PAYMENT TERMS : ${tx?.payment || "-"}`);

  lines.push("");
  lines.push("Yours Faithfully,"); // ✅ ALWAYS CONSTANT
  lines.push(BROKER.faithfully);

  return lines.join("\n");
}


async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchClientByName(name: string): Promise<Client | null> {
  const q = (name || "").trim();
  if (!q) return null;

  // If your /api/clients supports q, use it. If not, it will still return all.
  const data = await fetchJson(`/api/clients?q=${encodeURIComponent(q)}`);
  if (!Array.isArray(data) || data.length === 0) return null;

  const exact = data.find((x: any) => (x.name || "").toLowerCase() === q.toLowerCase());
  const best = exact || data[0];

  return {
    id: best.id,
    name: best.name,
    address: best.address,
    cityState: best.cityState ?? best.city_state,
    pinNo: best.pinNo ?? best.pin_no,
    phone: best.phone,
    mobile: best.mobile,
    email: best.email,
    gstNo: best.gstNo ?? best.gst ?? best.gstin,
    fssaiNo: best.fssaiNo ?? best.fssai,
  };
}

export default function TransactionsReport() {
  const nav = useNavigate();
  const { id } = useParams();

  const [tx, setTx] = React.useState<Tx | null>(null);
  const [seller, setSeller] = React.useState<Client | null>(null);
  const [buyer, setBuyer] = React.useState<Client | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const t = await fetchJson(`/api/transactions/${id}`);
        if (!alive) return;

        setTx(t);

        const [s, b] = await Promise.all([
          fetchClientByName(t?.seller),
          fetchClientByName(t?.buyer),
        ]);
        if (!alive) return;

        setSeller(s);
        setBuyer(b);
      } catch (e) {
        console.error(e);
        alert("Failed to load report. Check API and mapping.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const note = React.useMemo(() => buildConfirmationNote(tx || {}, seller || {}, buyer || {}), [tx, seller, buyer]);

  function sendWhatsApp(who: "seller" | "buyer") {
    const c = who === "seller" ? seller : buyer;
    const num = digitsOnly(c?.mobile);
    if (!num) return alert("No mobile/whatsapp number in client master");
    const url = `https://wa.me/${num}?text=${encodeURIComponent(note)}`;
    window.open(url, "_blank");
  }

  function sendEmail(who: "seller" | "buyer") {
    const c = who === "seller" ? seller : buyer;
    const to = (c?.email || "").trim();
    if (!to) return alert("No email in client master");
    const subj = `Confirmation Note - ${tx?.transaction_id || ""}`;
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(note)}`;
    window.location.href = url;
  }

  async function copyPreview() {
    try {
        await navigator.clipboard.writeText(note);
        alert("Copied to clipboard ✅");
    } catch (err) {
        alert("Failed to copy");
    }
  }


  if (loading) return <div style={{ padding: 20 }}>Loading report...</div>;
  if (!tx) return <div style={{ padding: 20 }}>No transaction found</div>;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={topRow}>
          <div style={headCellLeft}>SELLER</div>
          <div style={headCellRight}>BUYER</div>
        </div>

        <div style={grid}>
          {["Name", "Address", "City, State", "PIN No", "Phone", "TIN No", "CST No"].map((lbl, i) => (
            <React.Fragment key={lbl}>
              <div style={leftLbl}>{lbl}</div>
              <div style={leftVal}>
                {i === 0 ? seller?.name : i === 1 ? seller?.address : i === 2 ? seller?.cityState : i === 3 ? seller?.pinNo : i === 4 ? seller?.phone : i === 5 ? seller?.gstNo : seller?.gstNo}
              </div>
              <div style={rightVal}>
                {i === 0 ? buyer?.name : i === 1 ? buyer?.address : i === 2 ? buyer?.cityState : i === 3 ? buyer?.pinNo : i === 4 ? buyer?.phone : i === 5 ? buyer?.gstNo : buyer?.gstNo}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Mobile / Email blocks like old UI */}
        <div style={contactBlock}>
          <div style={contactRow}>
            <div style={contactLeft}>Seller Mobile</div>
            <div style={contactMidYellow}>{seller?.mobile || "-"}</div>
            <div style={contactMsg}>
              {tx?.product ? `Sold ${tx.product} Qty ${tx.quantity || "-"} @ ${tx.rate || "-"} ${tx.tax || ""}` : "—"}
            </div>
            <button style={sendBtn} onClick={() => sendWhatsApp("seller")}>Send</button>
          </div>

          <div style={contactRow}>
            <div style={contactLeft}>Seller e-Mail</div>
            <div style={contactMid}>{seller?.email || "-"}</div>
            <div style={contactMsgSmall}>Check below for preview</div>
            <button style={sendBtn} onClick={() => sendEmail("seller")}>Send</button>
          </div>

          <div style={{ ...contactRow, background: "#d9f3ff" }}>
            <div style={contactLeft}>Buyer Mobile</div>
            <div style={{ ...contactMidYellow, background: "#a6e8ff" }}>{buyer?.mobile || "-"}</div>
            <div style={contactMsgBlue}>
              {tx?.product ? `Purchased ${tx.product} Qty ${tx.quantity || "-"} @ ${tx.rate || "-"} ${tx.tax || ""}` : "—"}
            </div>
            <button style={sendBtn} onClick={() => sendWhatsApp("buyer")}>Send</button>
          </div>

          <div style={{ ...contactRow, background: "#d9f3ff" }}>
            <div style={contactLeft}>Buyer e-Mail</div>
            <div style={{ ...contactMid, background: "#c8f0ff" }}>{buyer?.email || "-"}</div>
            <div style={contactMsgSmall}>Check below for preview</div>
            <button style={sendBtn} onClick={() => sendEmail("buyer")}>Send</button>
          </div>
        </div>

        <div style={bottomActions}>
          <button style={btn} onClick={() => window.print()}>Print</button>
          <button style={btnPrimary} onClick={() => nav("/transactions/entry")}>OK</button>
        </div>

        {/* Printable text (optional) */}
        <div style={{ position: "relative" }}>
            <button
                onClick={copyPreview}
                style={{
                position: "absolute",
                right: 10,
                top: 10,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
                border: "1px solid #b0b8c4",
                background: "#f5f5f5",
                borderRadius: 4
                }}
            >
                Copy
            </button>

            <pre style={printBox}>
                {note}
            </pre>
         </div>

      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { padding: 18, background: "#eef2f7", minHeight: "100vh" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #c8ced8", borderRadius: 8, overflow: "hidden" };

const topRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr" };
const headCellLeft: React.CSSProperties = { background: "#f3d34a", padding: 8, fontWeight: 800, textAlign: "center", borderRight: "1px solid #c8ced8" };
const headCellRight: React.CSSProperties = { background: "#8fe3f6", padding: 8, fontWeight: 800, textAlign: "center" };

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "140px 1fr 1fr",
  borderTop: "1px solid #c8ced8",
};

const leftLbl: React.CSSProperties = { padding: 8, borderBottom: "1px solid #c8ced8", background: "#f7f7f7", fontSize: 12 };
const leftVal: React.CSSProperties = { padding: 8, borderBottom: "1px solid #c8ced8", borderLeft: "1px solid #c8ced8", borderRight: "1px solid #c8ced8", fontSize: 12 };
const rightVal: React.CSSProperties = { padding: 8, borderBottom: "1px solid #c8ced8", fontSize: 12 };

const contactBlock: React.CSSProperties = { borderTop: "1px solid #c8ced8",padding:"5px" };
const contactRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 220px 1fr 90px", gap: 0, alignItems: "stretch" };
const contactLeft: React.CSSProperties = { padding: 10, borderBottom: "1px solid #c8ced8", background: "#f7f7f7", fontSize: 12 };
const contactMidYellow: React.CSSProperties = { padding: 10, borderBottom: "1px solid #c8ced8", background: "#fff3b0", fontWeight: 800 };
const contactMid: React.CSSProperties = { padding: 10, borderBottom: "1px solid #c8ced8", background: "#f5f5f5" };
const contactMsg: React.CSSProperties = { padding: 10, borderBottom: "1px solid #c8ced8", fontSize: 12 };
const contactMsgBlue: React.CSSProperties = { padding: 10, borderBottom: "1px solid #c8ced8", fontSize: 12, background: "#bfefff" };
const contactMsgSmall: React.CSSProperties = { padding: 10, borderBottom: "1px solid #c8ced8", fontSize: 12, color: "#374151" };
const sendBtn: React.CSSProperties = { border: "1px solid #b0b8c4", background: "#efefef", cursor: "pointer", margin:"5px" };

const bottomActions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 12, padding: 14, borderTop: "1px solid #c8ced8" };
const btn: React.CSSProperties = { padding: "8px 18px", border: "1px solid #b0b8c4", background: "#f2f2f2", borderRadius: 6, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { ...btn, background: "#e6f0ff", borderColor: "#8aa8e8", fontWeight: 800 };

const printBox: React.CSSProperties = { margin: 0, padding: 14, borderTop: "1px solid #c8ced8", whiteSpace: "pre-wrap", fontSize: 12 };
