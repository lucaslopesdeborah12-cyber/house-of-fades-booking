import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarIcon, Clock, User, Scissors, X, Check, Calendar as CalendarDownloadIcon, Lock, Zap } from "lucide-react";
import emailjs from "@emailjs/browser";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import CountryCodeSelector, { COUNTRIES, formatPhoneForSubmit, type Country } from "@/components/CountryCodeSelector";
import WaitingListForm from "@/components/WaitingListForm";
import { notifyWaitingList } from "@/lib/waitingListNotifier";
import { downloadICS } from "@/lib/calendarDownload";

emailjs.init("TBNWeHLfrq6OuvZhQ");

type Barber = { id: string; name: string };
type Service = { id: string; name: string; price: number; duration_minutes: number };

const TIME_SLOTS = [
  "09:00", "09:20", "09:40", "10:00", "10:20", "10:40",
  "11:00", "11:20", "11:40", "12:00", "12:20", "12:40",
  "13:00", "13:20", "13:40", "14:00", "14:20", "14:40",
  "15:00", "15:20", "15:40", "16:00", "16:20", "16:40",
  "17:00", "17:20", "17:40", "18:00", "18:20", "18:40",
  "19:00",
];
const TOTAL_SLOTS = TIME_SLOTS.length;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedBarber?: string;
}

const BookingModal = ({ open, onOpenChange, preselectedBarber }: BookingModalProps) => {
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [monthAvailability, setMonthAvailability] = useState<Record<string, number>>({});
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [waitingListOpen, setWaitingListOpen] = useState(false);
  const [contactPreference, setContactPreference] = useState<'sms' | 'email' | 'call' | 'all' | null>(null);
  const [prefShakeTriggered, setPrefShakeTriggered] = useState(false);
  const { t } = useLanguage();

  const allSlotsBooked = selectedDate && bookedSlots.length >= TOTAL_SLOTS;
  const availableSlots = selectedDate ? TOTAL_SLOTS - bookedSlots.length : 0;
  const occupancyPercent = selectedDate ? (bookedSlots.length / TOTAL_SLOTS) * 100 : 0;

  const getUrgencyMessage = () => {
    if (!selectedDate || allSlotsBooked) return null;
    if (availableSlots === 1) return "🔥 Apenas 1 vaga restante!";
    if (availableSlots === 2) return "🔥 Apenas 2 vagas restantes!";
    if (occupancyPercent > 70) return "👀 Alta procura para este dia!";
    return null;
  };

  useEffect(() => {
    if (!open) return;
    supabase.from("barbers").select("id, name").then(({ data, error }) => {
      if (error) console.error("Barbers fetch error:", error);
      if (data && data.length > 0) {
        setBarbers(data);
        if (preselectedBarber) {
          const match = data.find(b => b.name.toLowerCase() === preselectedBarber.toLowerCase());
          if (match) { setSelectedBarber(match.id); setStep(2); }
        }
      }
    });
    supabase.from("services").select("id, name, price, duration_minutes").order("created_at").then(({ data, error }) => {
      if (error) console.error("Services fetch error:", error);
      if (data) setServices(data);
    });
  }, [open, preselectedBarber]);

  const fetchBookedSlots = useCallback(async () => {
    if (!selectedBarber || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { data, error } = await supabase.from("appointments").select("time_slot").eq("barber_id", selectedBarber).eq("appointment_date", dateStr).in("status", ["booked", "confirmed"]);
    if (error) return;
    const slots = (data || []).map(d => d.time_slot.slice(0, 5));
    setBookedSlots(slots);
    if (selectedTime && slots.includes(selectedTime)) setSelectedTime("");
  }, [selectedBarber, selectedDate, selectedTime]);

  useEffect(() => { fetchBookedSlots(); }, [selectedBarber, selectedDate]);

  const fetchMonthAvailability = useCallback(async () => {
    if (!open || step !== 3) return;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = format(new Date(year, month, 1), "yyyy-MM-dd");
    const lastDay = format(new Date(year, month + 1, 0), "yyyy-MM-dd");
    const query = supabase.from("appointments").select("appointment_date, barber_id").gte("appointment_date", firstDay).lte("appointment_date", lastDay).in("status", ["booked", "confirmed"]);
    if (selectedBarber) query.eq("barber_id", selectedBarber);
    const { data } = await query;
    if (!data) return;
    const countsByDate: Record<string, number> = {};
    if (selectedBarber) {
      data.forEach(row => { const d = row.appointment_date; countsByDate[d] = (countsByDate[d] || 0) + 1; });
    } else {
      const byDateBarber: Record<string, Record<string, number>> = {};
      data.forEach(row => {
        const d = row.appointment_date; const b = row.barber_id;
        if (!byDateBarber[d]) byDateBarber[d] = {};
        byDateBarber[d][b] = (byDateBarber[d][b] || 0) + 1;
      });
      Object.entries(byDateBarber).forEach(([date, barberCounts]) => { countsByDate[date] = Math.min(...Object.values(barberCounts)); });
    }
    setMonthAvailability(countsByDate);
  }, [calendarMonth, open, selectedBarber, step]);

  useEffect(() => { fetchMonthAvailability(); }, [fetchMonthAvailability]);

  useEffect(() => {
    if (!open) return;
    const monthFirstDay = format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1), "yyyy-MM-dd");
    const monthLastDay = format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0), "yyyy-MM-dd");
    const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
    const handleRealtimeAppointmentChange = (payload: any) => {
      const