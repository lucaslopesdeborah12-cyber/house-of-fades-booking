import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Upload, Plus, Trash2, Pencil } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

type SiteContent = Record<string, any>;

const useContent = (key: string) => {
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", key).maybeSingle().then(({ data }) => {
      if (data) setValue(data.value);
      setLoading(false);
    });
  }, [key]);

  const save = async (newVal: any) => {
    const { error } = await supabase.from("site_content").update({ value: newVal as Json }).eq("key", key);
    if (error) toast.error("Failed to save");
    else { setValue(newVal); toast.success("Saved!"); }
  };

  return { value, loading, save };
};

// Hero Editor
const HeroEditor = () => {
  const { value: hero, loading, save } = useContent("hero");
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (hero) setForm(hero); }, [hero]);

  if (loading) return <p className="text-muted-foreground font-body">Loading…</p>;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `hero/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data: { publicUrl } } = supabase.storage.from("site-assets").getPublicUrl(path);
    const updated = { ...form, [field]: publicUrl };
    setForm(updated);
    save(updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Hero Section</h3>
      <div>
        <Label className="text-foreground font-body text-sm">Tagline</Label>
        <Input value={form.tagline || ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Button Text</Label>
        <Input value={form.buttonText || ""} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Button Colour</Label>
        <Input type="color" value={form.buttonColor || "#8B1A1A"} onChange={(e) => setForm({ ...form, buttonColor: e.target.value })} className="mt-1 w-20 h-10 bg-background border-border" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Hero Background Image</Label>
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "heroImageUrl")} className="mt-1 text-foreground font-body text-sm" />
        {form.heroImageUrl && <img src={form.heroImageUrl} alt="Hero" className="mt-2 h-24 rounded object-cover" />}
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Logo Image</Label>
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "logoUrl")} className="mt-1 text-foreground font-body text-sm" />
        {form.logoUrl && <img src={form.logoUrl} alt="Logo" className="mt-2 h-16 object-contain" />}
      </div>
      <Button onClick={() => save(form)} className="bg-accent text-accent-foreground hover:bg-accent/80">
        <Save size={16} className="mr-1.5" /> Save Hero
      </Button>
    </div>
  );
};

// Services Editor
const ServicesEditor = () => {
  const [services, setServices] = useState<any[]>([]);
  const [newService, setNewService] = useState({ name: "", duration_minutes: 20, price: 0 });

  const fetch = async () => {
    const { data } = await supabase.from("services").select("*").order("created_at");
    if (data) setServices(data);
  };

  useEffect(() => { fetch(); }, []);

  const addService = async () => {
    if (!newService.name) return;
    const { error } = await supabase.from("services").insert(newService);
    if (error) toast.error(error.message);
    else { toast.success("Added!"); setNewService({ name: "", duration_minutes: 20, price: 0 }); fetch(); }
  };

  const updateService = async (id: string, updates: any) => {
    await supabase.from("services").update(updates).eq("id", id);
    toast.success("Updated!");
    fetch();
  };

  const deleteService = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    toast.success("Deleted!");
    fetch();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Services</h3>
      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="bg-card border border-border rounded-lg p-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <Input defaultValue={s.name} onBlur={(e) => updateService(s.id, { name: e.target.value })} className="flex-1 bg-background border-border text-foreground text-sm" />
            <Input type="number" defaultValue={s.duration_minutes} onBlur={(e) => updateService(s.id, { duration_minutes: parseInt(e.target.value) })} className="w-20 bg-background border-border text-foreground text-sm" />
            <div className="flex items-center gap-1">
              <span className="text-foreground text-sm">€</span>
              <Input type="number" step="0.01" defaultValue={s.price} onBlur={(e) => updateService(s.id, { price: parseFloat(e.target.value) })} className="w-20 bg-background border-border text-foreground text-sm" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => deleteService(s.id)} className="text-primary hover:text-primary/80"><Trash2 size={16} /></Button>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 bg-card border border-border rounded-lg p-3">
        <Input placeholder="Service name" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} className="flex-1 bg-background border-border text-foreground text-sm" />
        <Input type="number" placeholder="Min" value={newService.duration_minutes} onChange={(e) => setNewService({ ...newService, duration_minutes: parseInt(e.target.value) || 20 })} className="w-20 bg-background border-border text-foreground text-sm" />
        <Input type="number" step="0.01" placeholder="€" value={newService.price || ""} onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) || 0 })} className="w-20 bg-background border-border text-foreground text-sm" />
        <Button size="sm" onClick={addService} className="bg-accent text-accent-foreground hover:bg-accent/80"><Plus size={16} className="mr-1" /> Add</Button>
      </div>
    </div>
  );
};

// Reviews Editor
const ReviewsEditor = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [newReview, setNewReview] = useState({ author: "", text: "", rating: 5 });

  const fetch = async () => {
    const { data } = await supabase.from("reviews").select("*").order("created_at");
    if (data) setReviews(data);
  };

  useEffect(() => { fetch(); }, []);

  const addReview = async () => {
    if (!newReview.author || !newReview.text) return;
    await supabase.from("reviews").insert(newReview);
    toast.success("Added!");
    setNewReview({ author: "", text: "", rating: 5 });
    fetch();
  };

  const deleteReview = async (id: string) => {
    await supabase.from("reviews").delete().eq("id", id);
    toast.success("Deleted!");
    fetch();
  };

  const updateReview = async (id: string, updates: any) => {
    await supabase.from("reviews").update(updates).eq("id", id);
    toast.success("Updated!");
    fetch();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Reviews</h3>
      <div className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <Input defaultValue={r.author} onBlur={(e) => updateReview(r.id, { author: e.target.value })} className="w-32 bg-background border-border text-foreground text-sm" placeholder="Author" />
              <Input type="number" min={1} max={5} defaultValue={r.rating} onBlur={(e) => updateReview(r.id, { rating: parseInt(e.target.value) })} className="w-16 bg-background border-border text-foreground text-sm" />
              <Button size="sm" variant="ghost" onClick={() => deleteReview(r.id)} className="text-primary hover:text-primary/80"><Trash2 size={16} /></Button>
            </div>
            <Textarea defaultValue={r.text} onBlur={(e) => updateReview(r.id, { text: e.target.value })} className="bg-background border-border text-foreground text-sm" rows={2} />
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
          <Input placeholder="Author" value={newReview.author} onChange={(e) => setNewReview({ ...newReview, author: e.target.value })} className="flex-1 bg-background border-border text-foreground text-sm" />
          <Input type="number" min={1} max={5} value={newReview.rating} onChange={(e) => setNewReview({ ...newReview, rating: parseInt(e.target.value) || 5 })} className="w-16 bg-background border-border text-foreground text-sm" />
        </div>
        <Textarea placeholder="Review text" value={newReview.text} onChange={(e) => setNewReview({ ...newReview, text: e.target.value })} className="bg-background border-border text-foreground text-sm" rows={2} />
        <Button size="sm" onClick={addReview} className="bg-accent text-accent-foreground hover:bg-accent/80"><Plus size={16} className="mr-1" /> Add Review</Button>
      </div>
    </div>
  );
};

// About Editor
const AboutEditor = () => {
  const { value: about, loading, save } = useContent("about");
  const [text, setText] = useState("");

  useEffect(() => { if (about) setText(about.text || ""); }, [about]);
  if (loading) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">About Section</h3>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="bg-background border-border text-foreground" rows={4} />
      <Button onClick={() => save({ text })} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save</Button>
    </div>
  );
};

// Hours Editor
const HoursEditor = () => {
  const { value: hours, loading, save } = useContent("hours");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { if (hours) setItems(hours); }, [hours]);
  if (loading) return null;

  const update = (idx: number, field: string, val: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    setItems(updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Opening Hours</h3>
      <div className="space-y-2">
        {items.map((h: any, i: number) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-foreground font-body text-sm w-28">{h.day}</span>
            <Input value={h.time} onChange={(e) => update(i, "time", e.target.value)} className="flex-1 bg-background border-border text-foreground text-sm" />
          </div>
        ))}
      </div>
      <Button onClick={() => save(items)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save Hours</Button>
    </div>
  );
};

// Contact Editor
const ContactEditor = () => {
  const { value: contact, loading, save } = useContent("contact");
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (contact) setForm(contact); }, [contact]);
  if (loading) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Contact Info</h3>
      <div>
        <Label className="text-foreground font-body text-sm">Address</Label>
        <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Phone</Label>
        <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Email</Label>
        <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <Button onClick={() => save(form)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save</Button>
    </div>
  );
};

// Footer Editor
const FooterEditor = () => {
  const { value: footer, loading, save } = useContent("footer");
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (footer) setForm(footer); }, [footer]);
  if (loading) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Footer</h3>
      <div>
        <Label className="text-foreground font-body text-sm">Footer Text</Label>
        <Input value={form.text || ""} onChange={(e) => setForm({ ...form, text: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Instagram URL</Label>
        <Input value={form.instagram || ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Facebook URL</Label>
        <Input value={form.facebook || ""} onChange={(e) => setForm({ ...form, facebook: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Phone</Label>
        <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <Button onClick={() => save(form)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save</Button>
    </div>
  );
};

// Design Editor (Font + Colors)
const DesignEditor = () => {
  const { value: design, loading, save } = useContent("design");
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (design) setForm(design); }, [design]);
  if (loading) return null;

  const fonts = ["Playfair Display", "Merriweather", "Lora", "Cormorant Garamond", "Libre Baskerville"];

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Design Settings</h3>
      <div>
        <Label className="text-foreground font-body text-sm">Heading Font</Label>
        <select
          value={form.font || "Playfair Display"}
          onChange={(e) => setForm({ ...form, font: e.target.value })}
          className="mt-1 w-full bg-background border border-border text-foreground rounded-md px-3 py-2 font-body text-sm"
        >
          {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Primary Colour", key: "primaryColor" },
          { label: "Accent Colour", key: "accentColor" },
          { label: "Background Colour", key: "backgroundColor" },
          { label: "Text Colour", key: "textColor" },
        ].map(({ label, key }) => (
          <div key={key}>
            <Label className="text-foreground font-body text-sm">{label}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="color" value={form[key] || "#000"} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-10 h-10 p-0 bg-background border-border" />
              <Input value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="flex-1 bg-background border-border text-foreground text-sm" />
            </div>
          </div>
        ))}
      </div>
      <Button onClick={() => save(form)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save Design</Button>
    </div>
  );
};

// Main CMS Tab
const EditClientViewTab = () => {
  return (
    <div className="space-y-10">
      <HeroEditor />
      <hr className="border-border" />
      <ServicesEditor />
      <hr className="border-border" />
      <ReviewsEditor />
      <hr className="border-border" />
      <AboutEditor />
      <hr className="border-border" />
      <HoursEditor />
      <hr className="border-border" />
      <ContactEditor />
      <hr className="border-border" />
      <FooterEditor />
      <hr className="border-border" />
      <DesignEditor />
    </div>
  );
};

export default EditClientViewTab;
