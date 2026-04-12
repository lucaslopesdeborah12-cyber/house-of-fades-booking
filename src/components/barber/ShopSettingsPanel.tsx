import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Save } from "lucide-react";
import type { ShopSettings } from "@/hooks/useShopSettings";

interface Props {
  settings: ShopSettings;
  onSave: (key: keyof ShopSettings, value: string) => Promise<void>;
}

const TIME_SLOTS = Array.from({ length: 37 }, (_, i) => {
  const totalMin = 7 * 60 + i * 20;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const LABELS: Record<string, string> = {
  friday: "Friday (Mon–Fri)",
  saturday: "Saturday (Mon–Sat)",
  sunday: "Sunday (Mon–Sun)",
};

const ShopSettingsPanel = ({ settings, onSave }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ShopSettings>(settings);
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setDraft(settings);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const keys = Object.keys(draft) as (keyof ShopSettings)[];
    for (const key of keys) {
      if (draft[key] !== settings[key]) {
        await onSave(key, draft[key]);
      }
    }
    setSaving(false);
    setEditing(false);
    toast.success("Configurações salvas ✓");
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">Shop Settings</h3>
        {!editing && (
          <Button variant="outline" size="sm" onClick={handleEdit} className="font-body gap-1.5">
            <Pencil size={14} /> Editar
          </Button>
        )}
      </div>

      {/* Last working day */}
      <div className="space-y-1">
        <label className="font-body text-xs text-muted-foreground">Last working day of the week</label>
        {editing ? (
          <Select value={draft.last_working_day} onValueChange={(v) => setDraft((p) => ({ ...p, last_working_day: v as ShopSettings["last_working_day"] }))}>
            <SelectTrigger className="bg-background border-border text-foreground font-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friday">Friday (Mon–Fri)</SelectItem>
              <SelectItem value="saturday">Saturday (Mon–Sat)</SelectItem>
              <SelectItem value="sunday">Sunday (Mon–Sun)</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm font-body text-foreground px-3 py-2 bg-muted/30 rounded-md">{LABELS[settings.last_working_day]}</p>
        )}
      </div>

      {/* Default break time */}
      <div className="space-y-1">
        <label className="font-body text-xs text-muted-foreground">Default break time</label>
        {editing ? (
          <Select value={draft.default_break_time} onValueChange={(v) => setDraft((p) => ({ ...p, default_break_time: v }))}>
            <SelectTrigger className="bg-background border-border text-foreground font-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm font-body text-foreground px-3 py-2 bg-muted/30 rounded-md">{settings.default_break_time}</p>
        )}
      </div>

      {/* Working hours */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-body text-xs text-muted-foreground">Work start</label>
          {editing ? (
            <Select value={draft.work_start} onValueChange={(v) => setDraft((p) => ({ ...p, work_start: v }))}>
              <SelectTrigger className="bg-background border-border text-foreground font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-body text-foreground px-3 py-2 bg-muted/30 rounded-md">{settings.work_start}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="font-body text-xs text-muted-foreground">Work end</label>
          {editing ? (
            <Select value={draft.work_end} onValueChange={(v) => setDraft((p) => ({ ...p, work_end: v }))}>
              <SelectTrigger className="bg-background border-border text-foreground font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-body text-foreground px-3 py-2 bg-muted/30 rounded-md">{settings.work_end}</p>
          )}
        </div>
      </div>

      {editing && (
        <Button onClick={handleSave} disabled={saving} className="w-full font-body gap-1.5">
          <Save size={14} /> {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      )}
    </div>
  );
};

export default ShopSettingsPanel;
