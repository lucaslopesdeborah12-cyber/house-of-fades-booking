import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ShopSettings } from "@/hooks/useShopSettings";

interface Props {
  settings: ShopSettings;
  onSave: (key: keyof ShopSettings, value: string) => Promise<void>;
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const ShopSettingsPanel = ({ settings, onSave }: Props) => {
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (key: keyof ShopSettings, value: string) => {
    setSaving(key);
    await onSave(key, value);
    setSaving(null);
    toast.success("Setting saved!");
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <h3 className="font-serif text-lg font-semibold">Shop Settings</h3>

      {/* Last working day */}
      <div className="space-y-1">
        <label className="font-body text-xs text-muted-foreground">Last working day of the week</label>
        <Select
          value={settings.last_working_day}
          onValueChange={(v) => handleSave("last_working_day", v)}
        >
          <SelectTrigger className="bg-background border-border text-foreground font-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="friday">Friday (Mon–Fri)</SelectItem>
            <SelectItem value="saturday">Saturday (Mon–Sat)</SelectItem>
            <SelectItem value="sunday">Sunday (Mon–Sun)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Default break time */}
      <div className="space-y-1">
        <label className="font-body text-xs text-muted-foreground">Default break time</label>
        <Select
          value={settings.default_break_time}
          onValueChange={(v) => handleSave("default_break_time", v)}
        >
          <SelectTrigger className="bg-background border-border text-foreground font-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HALF_HOURS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Working hours */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-body text-xs text-muted-foreground">Work start</label>
          <Select
            value={settings.work_start}
            onValueChange={(v) => handleSave("work_start", v)}
          >
            <SelectTrigger className="bg-background border-border text-foreground font-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="font-body text-xs text-muted-foreground">Work end</label>
          <Select
            value={settings.work_end}
            onValueChange={(v) => handleSave("work_end", v)}
          >
            <SelectTrigger className="bg-background border-border text-foreground font-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ShopSettingsPanel;
