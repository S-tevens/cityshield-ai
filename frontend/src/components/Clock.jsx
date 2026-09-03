import { useEffect, useState } from "react";

export default function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour12: false });
  const date = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="clock">
      <span className="clock-time">{time}</span>
      <span className="clock-date">
        {date} &middot; {tz}
      </span>
    </div>
  );
}
