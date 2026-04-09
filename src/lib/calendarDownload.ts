export const downloadICS = (date: string, time: string, barberName: string, serviceName: string) => {
  // date format: "yyyy-MM-dd", time format: "HH:mm"
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const fmt = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//House of Fades//Booking//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:House of Fades - ${serviceName || "Haircut"}`,
    `DESCRIPTION:Your appointment at House of Fades with ${barberName}. See you soon!`,
    "LOCATION:House of Fades\\, Carlow\\, Ireland",
    "STATUS:CONFIRMED",
    `UID:${crypto.randomUUID()}@houseoffades`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const dataUri = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);

  // Try window.open first (works best on iOS Safari)
  const opened = window.open(dataUri);

  // Fallback: programmatic link click (works on Android / desktop)
  if (!opened) {
    const a = document.createElement("a");
    a.href = dataUri;
    a.download = "house-of-fades-appointment.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
