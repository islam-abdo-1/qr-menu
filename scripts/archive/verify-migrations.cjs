/**
 * SEC-003 — تحقق إعادة الإنتاجية (Reproducibility) لقاعدة البيانات:
 *  1) سجل migrations مطابق للملفات (كل مجلد مسجّل، لا فشل، لا معلّق، checksum سليم)
 *  2) مخطط قاعدة البيانات الحية مطابق لتوقعات schema.prisma (audit عبر information_schema)
 *  3) إثبات الإعادة: إعادة تشغيل كل migration.sql في سكيما مؤقتة (داخل معاملة تُتراجع)
 *     ثم مقارنة السكيما الناتجة بنفس audit — أي: migrations وحدها تعيد بناء المخطط
 * ملاحظة: Prisma CLI نفسها لا تستطيع مسح schema عبر الـ pooler (prepared statements)
 * والاتصال المباشر محجوب من هذه الشبكة — لذا الفحص مبني على SQL مباشر (pooler-safe).
 * التشغيل: npm run security:migrations
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnv(path.join(__dirname, "..", ".env.local"));
const MIGRATIONS_DIR = path.join(__dirname, "..", "prisma", "migrations");

/** قراءة migration.sql مع تجريد BOM — يمنع فشل إعادة التشغيل على أنظمة ملفات تضيفه */
function readMigrationSql(folder) {
  let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8");
  if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);
  return sql;
}

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ✔ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

/** توقعات المخطط — مرآة حرفية لـ prisma/schema.prisma (اسم عمود: [نوع، notNull، default])
 *  defaults: false = بلا قيمة افتراضية في القاعدة · true = يوجد (بدون مقارنة نص) · نص = يقارن
 *  types: text | varchar(64) | integer | double precision | boolean | date | timestamptz(3) | timestamp(3) | uuid | serial
 */
const TYPES = {
  text: "text",
  "varchar(64)": "character varying(64)",
  integer: "integer",
  serial: "integer",
  "double precision": "double precision",
  boolean: "boolean",
  date: "date",
  "timestamp(3)": "timestamp(3) without time zone",
  "timestamptz(3)": "timestamp(3) with time zone",
  uuid: "uuid",
};
const COL = (type, nn, def) => ({ type: TYPES[type], nn: !!nn, def });

const TABLES = {
  Restaurant: {
    cols: {
      id: COL("text", true, false), slug: COL("text", true, false),
      name: COL("text", true, false), ownerId: COL("text", true, false),
      staffPin: COL("text", true, "'" + "" + "'::text"), pinFailedAttempts: COL("integer", true, "0"),
      pinLockedUntil: COL("timestamp(3)", false, false), blocked: COL("boolean", true, "false"),
      trialEndsAt: COL("timestamp(3)", false, false), paidUntil: COL("timestamp(3)", false, false),
      billingExempt: COL("boolean", true, "false"), createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [["slug"], ["ownerId"]],
  },
  SiteSetting: {
    cols: {
      id: COL("serial", true, true), key: COL("text", true, false), value: COL("text", true, "''::text"),
    },
    pks: [["id"]],
    uniques: [["key"]],
  },
  Payment: {
    cols: {
      id: COL("text", true, false), restaurantId: COL("text", true, false),
      amount: COL("double precision", true, false), plan: COL("text", true, "'monthly'::text"),
      method: COL("text", true, "'manual'::text"), paymobRef: COL("text", false, false),
      status: COL("text", true, "'paid'::text"), createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [["paymobRef"]],
    fks: 1,
    indexes: [`("restaurantId", "createdAt" DESC)`],
  },
  AuditLog: {
    cols: {
      id: COL("text", true, false), actorEmail: COL("text", true, false),
      action: COL("text", true, false), targetType: COL("text", true, false),
      targetName: COL("text", true, false), createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [],
    indexes: [`("createdAt" DESC)`],
  },
  OwnerLoginAttempt: {
    cols: {
      id: COL("text", true, false), email: COL("text", true, false),
      success: COL("boolean", true, "false"), createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [],
    indexes: [`("email", "createdAt" DESC)`],
  },
  Setting: {
    cols: {
      id: COL("serial", true, true), restaurantId: COL("text", true, false),
      restaurantName: COL("text", true, "'مطعمي'::text"), currency: COL("text", true, "'EGP'::text"),
      themePrimary: COL("text", true, "'#C84C21'::text"), logoUrl: COL("text", false, "''::text"),
      logoWidth: COL("integer", false, false), logoHeight: COL("integer", false, false),
      logoSizeKB: COL("integer", false, false), deliveryEnabled: COL("boolean", true, "true"),
      createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [["restaurantId"]],
    fks: 1,
  },
  Category: {
    cols: {
      id: COL("uuid", true, false), restaurantId: COL("text", true, false),
      name: COL("text", true, false), sortOrder: COL("integer", true, "0"),
      createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [],
    fks: 1,
    indexes: [`("restaurantId")`],
  },
  MenuItem: {
    cols: {
      id: COL("uuid", true, false), restaurantId: COL("text", true, false),
      name: COL("text", true, false), description: COL("text", false, false),
      price: COL("double precision", true, false), discountPercentage: COL("integer", false, false),
      imageUrl: COL("text", false, false), imageWidth: COL("integer", false, false),
      imageHeight: COL("integer", false, false), imageSizeKB: COL("integer", false, false),
      isAvailable: COL("boolean", true, "true"), sizeMode: COL("text", true, "'letters'::text"),
      categoryId: COL("uuid", true, false), createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [],
    fks: 2,
    indexes: [`("restaurantId")`, `("categoryId")`],
  },
  MenuItemSize: {
    cols: {
      id: COL("uuid", true, false), sizeCode: COL("text", true, false),
      price: COL("double precision", true, false), menuItemId: COL("uuid", true, false),
      createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [["menuItemId", "sizeCode"]],
    fks: 1,
    indexes: [`("menuItemId")`],
  },
  Favorite: {
    cols: {
      id: COL("uuid", true, false), userId: COL("text", true, false),
      itemId: COL("uuid", true, false), createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [["userId", "itemId"]],
    fks: 1,
  },
  Order: {
    cols: {
      id: COL("uuid", true, false), restaurantId: COL("text", true, false),
      number: COL("integer", true, false), type: COL("text", true, false),
      customerName: COL("text", true, false), tableNo: COL("text", false, false),
      phone: COL("text", false, false), address: COL("text", false, false),
      notes: COL("text", false, false), status: COL("text", true, "'new'::text"),
      staffName: COL("text", false, false), completedAt: COL("timestamp(3)", false, false),
      total: COL("double precision", true, false), cartNonce: COL("varchar(64)", false, false),
      createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [["restaurantId", "number"], ["restaurantId", "cartNonce"]],
    fks: 1,
    indexes: [`("restaurantId", "createdAt" DESC)`],
  },
  OrderWindow: {
    cols: {
      restaurantId: COL("text", true, false),
      windowStart: COL("timestamptz(3)", true, false),
      count: COL("integer", true, "0"),
    },
    pks: [["restaurantId", "windowStart"]],
    uniques: [],
  },
  DayStat: {
    cols: {
      id: COL("text", true, false), restaurantId: COL("text", true, false),
      date: COL("date", true, false), revenue: COL("double precision", true, "0"),
      orders: COL("integer", true, "0"), dineIn: COL("integer", true, "0"),
      delivery: COL("integer", true, "0"), scans: COL("integer", true, "0"),
    },
    pks: [["id"]],
    uniques: [["restaurantId", "date"]],
    fks: 1,
  },
  Staff: {
    cols: {
      id: COL("text", true, false), restaurantId: COL("text", true, false),
      name: COL("text", true, false), createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [],
    fks: 1,
    indexes: [`("restaurantId")`],
  },
  Table: {
    cols: {
      id: COL("text", true, false), restaurantId: COL("text", true, false),
      number: COL("integer", true, false), reserved: COL("boolean", true, "false"),
      createdAt: COL("timestamp(3)", true, "now()"),
    },
    pks: [["id"]],
    uniques: [["restaurantId", "number"]],
    fks: 1,
  },
  OrderItem: {
    cols: {
      id: COL("uuid", true, false), orderId: COL("uuid", true, false),
      itemId: COL("text", false, false), name: COL("text", true, false),
      sizeCode: COL("text", false, false), price: COL("double precision", true, false),
      qty: COL("integer", true, false),
    },
    pks: [["id"]],
    uniques: [],
    fks: 1, // المخطط يعلن علاقة order فقط (itemId مرجع وصفي بلا علاقة Prisma)
    indexes: [`("orderId")`, `("itemId")`],
  },
};

/** audit — يفحص مخططًا كاملًا (public أو سكيما مؤقتة) مقابل التوقعات */
async function auditSchema(client, schemaName) {
  const out = [];
  const t = { name: schemaName };
  try {
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
      [schemaName],
    );
    const actual = tables.rows.map((r) => r.table_name).filter((n) => n !== "_prisma_migrations");
    const expected = Object.keys(TABLES).sort();
    t.tables = { actual, expected };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) return t;

    for (const [table, spec] of Object.entries(TABLES)) {
      const cols = await client.query(
        `SELECT a.attname AS column_name,
                pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
                CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
                pg_get_expr(d.adbin, d.adrelid) AS column_default
         FROM pg_catalog.pg_attribute a
         LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
         ORDER BY a.attnum`,
        [schemaName, table],
      );
      const colMap = new Map(cols.rows.map((c) => [c.column_name, c]));
      const expectedCols = Object.keys(spec.cols).sort();
      const actualCols = cols.rows.map((c) => c.column_name).sort();
      if (JSON.stringify(actualCols) !== JSON.stringify(expectedCols)) {
        t[table] = { issue: "columns mismatch", actualCols, expectedCols };
        continue;
      }
      for (const [col, exp] of Object.entries(spec.cols)) {
        const c = colMap.get(col);
        const typeOk = c.data_type === exp.type;
        const nnOk = exp.nn ? c.is_nullable === "NO" : c.is_nullable === "YES";
        let defOk = true;
        if (exp.def === false) defOk = c.column_default === null;
        else if (typeof exp.def === "string") {
          const norm = (s) =>
            (s || "").replace(/::text$|::character varying$|::double precision$/i, "").replace(/^CURRENT_TIMESTAMP$/, "now()");
          defOk = norm(c.column_default) === norm(exp.def);
        } else if (exp.def === true) defOk = c.column_default !== null;
        if (!typeOk || !nnOk || !defOk) {
          t[`${table}.${col}`] = { actual: { type: c.data_type, nn: c.is_nullable, def: c.column_default }, exp };
        }
      }
    }

    // مفاتيح أساسية
    for (const [table, spec] of Object.entries(TABLES)) {
      const pks = await client.query(
        `SELECT kcu.column_name FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
         ORDER BY kcu.ordinal_position`,
        [schemaName, table],
      );
      const actualPk = pks.rows.map((r) => r.column_name);
      const expectedPk = spec.pks[0];
      if (JSON.stringify(actualPk) !== JSON.stringify(expectedPk)) {
        t[`${table}.pk`] = { actualPk, expectedPk };
      }
    }

    // فهارس فريدة (بأعمدتها، بغض النظر عن الاسم/الاقتباس)
    const idx = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname NOT LIKE '%_pkey'`,
      [schemaName],
    );
    const idxDefs = idx.rows.map((r) => r.indexdef);
    // تطبيع: إزالة الاقتباسات والمسافات (PG قد لا يقتبس المعرفات الصغيرة)
    const norm = (s) => s.replace(/"/g, "").replace(/\s+/g, "");
    for (const [table, spec] of Object.entries(TABLES)) {
      for (const cols of spec.uniques) {
        const found = idxDefs.some(
          (d) => norm(d).includes("CREATEUNIQUEINDEX") && norm(d).includes(table) && cols.every((c) => norm(d).includes(norm(c))),
        );
        if (!found) t[`${table}.unique(${cols.join(",")})`] = "missing";
      }
      for (const pat of spec.indexes || []) {
        const found = idxDefs.some(
          (d) => /CREATE (UNIQUE )?INDEX/.test(d) && d.includes(table) && norm(d).includes(norm(pat)),
        );
        if (!found) t[`${table}.index ${pat}`] = "missing";
      }
    }

    // أعداد مفاتيح أجنبية
    for (const [table, spec] of Object.entries(TABLES)) {
      if (!spec.fks) continue;
      const fk = await client.query(
        `SELECT COUNT(*)::int AS n FROM information_schema.table_constraints
         WHERE table_schema = $1 AND table_name = $2 AND constraint_type = 'FOREIGN KEY'`,
        [schemaName, table],
      );
      if (fk.rows[0].n < spec.fks) t[`${table}.fk`] = `expected>=${spec.fks}, got ${fk.rows[0].n}`;
    }
  } catch (e) {
    t.error = e.message;
  }
  return t;
}

async function main() {
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    /* 1) سجل migrations */
    console.log("■ سجل migrations:");
    const ledger = await client.query(
      `SELECT migration_name, finished_at, checksum, rolled_back_at, applied_steps_count
       FROM "_prisma_migrations" ORDER BY migration_name`,
    );
    const folders = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((d) => fs.existsSync(path.join(MIGRATIONS_DIR, d, "migration.sql")))
      .sort();
    check("عدد مجلدات migrations = سجلات الـ ledger", folders.length === ledger.rows.length,
      `folders=${folders.length} ledger=${ledger.rows.length}`);
    const names = new Set(ledger.rows.map((r) => r.migration_name));
    check("كل مجلد مسجّل في الـ ledger", folders.every((f) => names.has(f)));
    check("لا سجلات بلا مجلد مقابل", ledger.rows.every((r) => folders.includes(r.migration_name)));
    check("لا migrtions فاشلة (rolled_back_at NULL)", ledger.rows.every((r) => !r.rolled_back_at));
    check("لا migrtions معلّقة (finished_at موجودة)", ledger.rows.every((r) => r.finished_at));
    console.log(`  (خطوات التطبيق المسجلة: ${[...new Set(ledger.rows.map((r) => r.applied_steps_count ?? 0))].join(", ")} — معلوماتية فقط)`);
    let checksumOk = true;
    for (const f of folders) {
      const sql = readMigrationSql(f);
      const expected = crypto.createHash("sha256").update(sql).digest("hex");
      const row = ledger.rows.find((r) => r.migration_name === f);
      if (!row || row.checksum !== expected) checksumOk = false;
    }
    check("checksums مطابقة لمحتوى migration.sql", checksumOk);

    /* 2) المخطط الحي مقابل schema.prisma */
    console.log("■ مخطط قاعدة الإنتاج (public):");
    const live = await auditSchema(client, "public");
    const liveIssues = Object.keys(live).filter((k) => !["name", "tables"].includes(k));
    check("كل الجداول موجودة ولا زيادة (16 جدولًا)", live.tables && JSON.stringify(live.tables.actual) === JSON.stringify(live.tables.expected),
      live.tables ? `got=${live.tables.actual.join(",")}` : "");
    if (live.tables && JSON.stringify(live.tables.actual) === JSON.stringify(live.tables.expected)) {
      check("أعمدتها وأنواعها وإلزامها وافتراضاتها مطابقة (مفتاح، فريد، فهرس، FK)", liveIssues.length === 0,
        liveIssues.map((k) => `${k}: ${JSON.stringify(live[k]).slice(0, 220)}`).join(" | "));
    }

    /* 3) إعادة الإنتاج: إعادة تشغيل كل migrations في سكيما مؤقتة ومقارنتها */
    console.log("■ إعادة الإنتاج (إعادة تشغيل migrations على مخطط فارغ):");
    const repro = "repro_verify_" + crypto.randomBytes(4).toString("hex");
    await client.query("BEGIN");
    try {
      await client.query(`CREATE SCHEMA "${repro}"`);
      // عزل تام: search_path = السكيما المؤقتة فقط (لا public) — يمنع أي تسريب
      // لمجسات إنتاج حية أثناء الفحص
      await client.query(`SET search_path = "${repro}"`);
      let replayFailed = null;
      for (const f of folders) {
        let sql = readMigrationSql(f);
        // عبارات البنية (storage.*) وجدول البنية (_prisma_migrations) خاصة
        // ببنية Supabase/Prisma التحتية — لا دخل لها بإعادة إنتاج مخطط التطبيق
        // (تتحقق منها rls-probe منفصلة). نفلتر على مستوى العبارة (تختم بـ ;)
        // حتى لا تبقى أجزاء معلّقة عند إسقاط عبارة متعددة الأسطر.
        if (/storage\.|_prisma_migrations/.test(sql)) {
          const stmts = sql.split(/;\s*\r?\n/);
          sql = stmts
            .filter((s) => !/storage\./.test(s) && !/_prisma_migrations/.test(s))
            .join(";\n");
        }
        // إعادة توجيه الإشارات الصريحة إلى public نحو السكيما المؤقتة
        // (مثل ENABLE RLS / REVOKE — نفس الدلالات على السكيما المؤقتة)
        sql = sql.replace(/public\./g, `"${repro}".`);
        try {
          await client.query(sql);
        } catch (e) {
          replayFailed = `${f}: ${e.message}`;
          break;
        }
      }
      check("كل migration.sql يعاد تشغيله بلا أخطاء على مخطط فارغ", !replayFailed, replayFailed || "");
      if (!replayFailed) {
        const rebuilt = await auditSchema(client, repro);
        const issues = Object.keys(rebuilt).filter((k) => !["name", "tables"].includes(k));
        check("المخطط المعاد بناؤه مطابق تمامًا لـ schema.prisma", issues.length === 0,
          issues.map((k) => `${k}: ${JSON.stringify(rebuilt[k]).slice(0, 600)}`).join(" | "));
      }
      await client.query(`SET search_path = public`);
      await client.query(`DROP SCHEMA "${repro}" CASCADE`);
      await client.query("COMMIT");
      console.log("  (السكيما المؤقتة حُذفت بالكامل — لا أثر)");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  } finally {
    await client.end();
  }

  console.log(
    failures === 0
      ? "\n✓ SEC-003: مخططات قابلة للإعادة بالكامل — ledger سليم · لا انجراف · migrations وحدها تعيد بناء schema.prisma"
      : `\n✗ SEC-003: فشل ${failures} فحص`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

const watchdog = new Promise((_, rej) =>
  setTimeout(() => rej(new Error("انتهت مهلة فحص migrations (120 ثانية)")), 120_000),
);
Promise.race([main(), watchdog]).catch((e) => {
  console.error("✗ خطأ تشغيلي:", e.message);
  process.exitCode = 1;
});