-- DayStat.scans: QR menu visit counter (incremented on every menu page open)
ALTER TABLE "DayStat" ADD COLUMN "scans" INTEGER NOT NULL DEFAULT 0;