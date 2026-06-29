import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, ArrowRight, Check } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/import")({
  head: () => ({ meta: [{ title: "Import data — Syncletics" }] }),
  component: ImportPage,
});

// Lazily loads SheetJS from its CDN, only in the browser, and caches the promise.
const XLSX_CDN = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
let xlsxPromise: Promise<any> | null = null;
function loadXLSX(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("XLSX is only available in the browser"));
  }
  if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = XLSX_CDN;
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error("Failed to load the spreadsheet parser"));
    document.head.appendChild(script);
  });
  return xlsxPromise;
}

// Fields in the new schema that a spreadsheet column can map onto.
const TARGET_FIELDS = [
  { key: "ignore", label: "— Don't import —" },
  { key: "display_name", label: "Member name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role (member / parent / coach)" },
  { key: "course", label: "Course / group name" },
] as const;

type Step = "upload" | "map" | "done";

function ImportPage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const { data: courses } = useQuery({
    enabled: !!club,
    queryKey: ["courses", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_groups")
        .select("id, name")
        .eq("club_id", club!.id);
      return data || [];
    },
  });

  // --- Step 1: fetch + parse the uploaded spreadsheet ---
  const onFile = async (file: File) => {
    try {
      // Load SheetJS in the browser from the official CDN. This avoids bundling
      // the heavy xlsx CJS package, which breaks the production (SSR) build.
      const XLSX: any = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: "",
      });
      if (!json.length) {
        toast.error("That sheet looks empty");
        return;
      }
      const cols = Object.keys(json[0]);
      // Best-effort auto-mapping by column name.
      const auto: Record<string, string> = {};
      for (const c of cols) {
        const lc = c.toLowerCase();
        if (/name/.test(lc) && !auto.__name) auto[c] = "display_name";
        else if (/e-?mail/.test(lc)) auto[c] = "email";
        else if (/role|type/.test(lc)) auto[c] = "role";
        else if (/course|group|team|class/.test(lc)) auto[c] = "course";
        else auto[c] = "ignore";
      }
      setFileName(file.name);
      setHeaders(cols);
      setRows(json);
      setMapping(auto);
      setStep("map");
    } catch (e: any) {
      toast.error("Could not parse file: " + (e?.message ?? "unknown error"));
    }
  };

  // --- Step 3: bulk migrate the parsed + mapped records ---
  const runImport = async () => {
    if (!club) return;
    const fieldFor = (target: string) =>
      headers.find((h) => mapping[h] === target);
    const nameCol = fieldFor("display_name");
    const emailCol = fieldFor("email");
    const roleCol = fieldFor("role");
    const courseCol = fieldFor("course");

    if (!emailCol) {
      toast.error("Map a column to Email so members can be matched");
      return;
    }

    const courseByName = new Map(
      (courses || []).map((c: any) => [String(c.name).toLowerCase(), c.id]),
    );

    setBusy(true);
    let ok = 0;
    for (const row of rows) {
      const email = String(row[emailCol] ?? "").trim().toLowerCase();
      if (!email) continue;
      const display_name = nameCol ? String(row[nameCol] ?? "").trim() : null;
      const rawRole = roleCol ? String(row[roleCol] ?? "").trim().toLowerCase() : "";
      const role = ["member", "parent", "coach"].includes(rawRole) ? rawRole : "member";
      const groupId = courseCol
        ? courseByName.get(String(row[courseCol] ?? "").trim().toLowerCase()) ?? null
        : null;

      // Upsert the profile, then the membership. We match on email so re-imports
      // update rather than duplicate.
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .upsert({ email, display_name }, { onConflict: "email" })
        .select("id")
        .single();
      if (pErr || !profile) continue;

      const { error: mErr } = await supabase
        .from("memberships")
        .upsert(
          {
            club_id: club.id,
            user_id: profile.id,
            role,
            group_id: groupId,
            approved: true,
          },
          { onConflict: "club_id,user_id" },
        );
      if (!mErr) ok++;
    }
    setBusy(false);
    setImportedCount(ok);
    setStep("done");
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["course-memberships"] });
    toast.success(`Imported ${ok} member${ok === 1 ? "" : "s"}`);
  };

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImportedCount(0);
  };

  if (!isStaff) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Only club staff can import data.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Import data</h1>
        <p className="text-sm text-muted-foreground">
          Bring members over from your previous software via an Excel spreadsheet.
        </p>
      </div>

      {step === "upload" && (
        <Card
          className="flex flex-col items-center justify-center gap-3 border-dashed p-12 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </span>
          <p className="font-medium">Drop an .xlsx / .csv file here</p>
          <p className="text-xs text-muted-foreground">or choose a file from your computer</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} className="mt-2 bg-gradient-hero">
            Choose file
          </Button>
        </Card>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <Card className="flex items-center gap-3 p-4">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {rows.length} rows · {headers.length} columns detected
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              Change file
            </Button>
          </Card>

          <Card className="p-5">
            <p className="mb-1 font-medium">Map columns</p>
            <p className="mb-4 text-xs text-muted-foreground">
              Match each spreadsheet column to a field in Syncletics.
            </p>
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="truncate rounded-md border border-border bg-secondary px-3 py-2 text-sm">
                    {h}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={mapping[h] ?? "ignore"}
                    onValueChange={(v) => setMapping({ ...mapping, [h]: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={runImport} disabled={busy} className="bg-gradient-hero">
              {busy ? "Importing…" : \`Import \${rows.length} rows\`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10">
            <Check className="h-6 w-6 text-primary" />
          </span>
          <p className="font-medium">Import complete</p>
          <p className="text-sm text-muted-foreground">
            {importedCount} member{importedCount === 1 ? "" : "s"} added or updated.
          </p>
          <Button onClick={reset} variant="outline" className="mt-2">
            Import another file
          </Button>
        </Card>
      )}
    </div>
  );
}
