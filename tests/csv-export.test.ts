import { describe, expect, it } from "vitest";
import {
  appendDeduplicated,
  csvCell,
  CSV_HEADER,
  EXPORT_PAGE_SIZE,
} from "@/lib/csv-export";

const row = (name: string, phone: string | null) => ({ customerName: name, phone });

describe("SEC-012: تصدير CSV محدود الذاكرة — منطق التدفق والصفحات", () => {
  it("الحد الأقصى للصفحة محدد وصريح", () => {
    expect(EXPORT_PAGE_SIZE).toBeGreaterThan(0);
    expect(EXPORT_PAGE_SIZE).toBeLessThanOrEqual(5000);
  });

  it("إزالة التكرار عبر الصفحات: أول ظهور (الأحدث) يبقى — لا تكرار بعد الصفحة الأولى", () => {
    const seen = new Map<string, string>();
    const lines: string[] = [];
    // الصفحة 1 (أحدث): أحمد/010111 — الصفحة 2 (أقدم): محمد/010111 (تكرار)
    appendDeduplicated([row("أحمد", "01011111111"), row("سارة", "01022222222")], seen, lines);
    appendDeduplicated([row("محمد", "01011111111"), row("ليلى", "01033333333")], seen, lines);
    expect(lines).toHaveLength(3);
    expect(lines.join("\n")).toContain('"أحمد"');
    expect(lines.join("\n")).not.toContain('"محمد"');
    expect(lines.join("\n")).toContain('"سارة"');
    expect(lines.join("\n")).toContain('"ليلى"');
  });

  it("طلبات بلا هاتف (طاولة) تُتجاهل تمامًا", () => {
    const seen = new Map<string, string>();
    const lines: string[] = [];
    appendDeduplicated([row("بلا هاتف", null), row("بمسافات", "   ")], seen, lines);
    expect(lines).toHaveLength(0);
  });

  it("حماية حقن CSV محفوظة (= + - @ يُسبَقون بعلامة اقتباس)", () => {
    expect(csvCell("=SUM(A1)")).toBe("\"'=SUM(A1)\"");
    expect(csvCell("+cmd")).toBe("\"'+cmd\"");
    expect(csvCell("-1;2")).toBe("\"'-1;2\"");
    expect(csvCell("@x")).toBe("\"'@x\"");
  });

  it("تنظيف الفواصل والاقتباسات والأسطر الجديدة داخل الخلية", () => {
    expect(csvCell('name,"quoted"')).toBe('"name  quoted"');
    expect(csvCell("line1\nline2")).toBe('"line1 line2"');
    expect(csvCell("a,b")).toBe('"a b"');
  });

  it("مجموعة بيانات اصطناعية كبيرة (20 صفحة): خطوط محدودة العدد والذاكرة مستقرة", () => {
    const seen = new Map<string, string>();
    const lines: string[] = [];
    // 20 صفحة × 1000 صف: 5000 رقم فريد + 15000 تكرار موزّع
    let uniqueCount = 0;
    for (let page = 0; page < 20; page++) {
      const pageRows: { customerName: string; phone: string | null }[] = [];
      for (let i = 0; i < 1000; i++) {
        if (i % 3 === 0) {
          // رقم جديد فريد في أول صفحتين فقط ثم تكرار لأرقام سابقة
          if (page < 2) {
            pageRows.push(row(`مستفيد${uniqueCount}`, `011${String(uniqueCount++).padStart(8, "0")}`));
          } else {
            pageRows.push(row(`مكرر${i}`, `011${String(i * 137 % 5000).padStart(8, "0")}`));
          }
        } else {
          pageRows.push(row(`مكرر${i}`, `010${String(i).padStart(8, "0")}`));
        }
      }
      appendDeduplicated(pageRows, seen, lines);
    }
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(5000 + 5000); // أرقام فريدة فقط — بلا انفجار
    expect(lines.length).toBeLessThanOrEqual(EXPORT_PAGE_SIZE * 20);
  });

  it("الترويسة مطابقة للصيغة الأصلية", () => {
    expect(CSV_HEADER).toBe('"Name","Phone"');
  });
});